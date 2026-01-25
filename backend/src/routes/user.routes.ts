// USER ROUTES - Handles user authentication, profile management, and Google OAuth
// Endpoints: POST /register, POST /login, POST /google-auth, GET /:id, PUT /:id, POST /forgot-password
// Features: User registration/login, Google Sign-In, profile updates, password reset
import { Router, type Request, type Response } from "express";
import User from "../models/User.model";
import crypto from 'crypto';
import { logAdminActivity } from "./dashboard.routes";
import { OAuth2Client } from 'google-auth-library';
import { sendUserOTPEmail } from '../utils/userEmailService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for profile photo uploads
const profilePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile photos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Register new user (basic, no hashing yet; add hashing later)
router.post("/register", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const { username, firstName, lastName, email, password } = body;
    if (!username || !firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({ 
      username: username.trim(), 
      firstName: firstName.trim(), 
      lastName: lastName.trim(), 
      email: normalizedEmail, 
      password 
    });
    return res.status(201).json({ 
      id: user.id, 
      email: user.email, 
      username: user.username, 
      firstName: user.firstName 
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: "Registration failed", error: String(err) });
  }
});

// Login (basic, compares plain passwords; add hashing later)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const identifier = body.identifier;
    const password = body.password;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }
    
    const normalizedIdentifier = identifier.trim();
    const query = normalizedIdentifier.includes('@')
      ? { email: normalizedIdentifier.toLowerCase() }
      : { username: normalizedIdentifier };

    console.log('Login attempt:', { query, password: password ? '[HIDDEN]' : 'MISSING' });
    
    const user = await User.findOne(query);
    if (!user) {
      console.log('User not found with query:', query);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    console.log('User found:', { id: user.id, email: user.email, username: user.username });
    
    if (user.password !== password) {
      console.log('Password mismatch for user:', user.email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('Login successful for:', user.email);
    
    // Log admin login activity
    if (user.role === 'admin') {
      await logAdminActivity(
        user.id,
        'admin_login',
        `Admin ${user.firstName} ${user.lastName} logged in`,
        user.id,
        'user'
      );
    }
    
    return res.json({ 
      id: user.id, 
      email: user.email, 
      username: user.username, 
      firstName: user.firstName,
      lastName: user.lastName || '',
      profilePhoto: user.profilePhoto,
      role: user.role 
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Login failed', error: String(err) });
  }
});



// Forgot password - send OTP
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Avoid leaking user existence
      return res.json({ message: 'If an account exists, an OTP has been sent' });
    }

    const otpCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
    const otpExpires = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes
    user.set({ otpCode, otpExpires });
    await user.save();

    // Send OTP via email
    try {
      const emailResult = await sendUserOTPEmail(email, otpCode, user.firstName);
      
      if (emailResult.success) {
        console.log(`✅ OTP email sent to ${email}`);
      } else {
        console.error(`❌ Failed to send OTP email: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      // Continue even if email fails - OTP is still saved
    }

    // For testing - show OTP in console
    console.log(`📧 OTP for ${email}: ${otpCode}`);
    
    return res.json({ 
      message: 'OTP sent to your email', 
      email: email,
      // For testing only - remove in production
      otp: process.env.NODE_ENV === 'development' ? otpCode : undefined
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body as { email?: string; otp?: string };
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      otpCode: otp, 
      otpExpires: { $gt: new Date() } 
    });
    
    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    // Generate reset token after OTP verification
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
    user.set({ resetToken, resetTokenExpires, otpCode: undefined, otpExpires: undefined });
    await user.save();

    return res.json({ message: 'OTP verified', resetToken });
  } catch (err) {
    return res.status(500).json({ message: 'OTP verification failed' });
  }
});

// Reset password - verify token and set new password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) return res.status(400).json({ message: 'Missing token or password' });

    const user = await User.findOne({ resetToken: token, resetTokenExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.set({ password, resetToken: undefined, resetTokenExpires: undefined });
    await user.save();
    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to reset password' });
  }
});

// Update profile photo - MUST come before /:id route to avoid route conflict
router.patch('/profile-photo', uploadProfilePhoto.single('profilePhoto'), async (req: Request, res: Response) => {
  try {
    // Log request body for debugging
    console.log('Profile photo upload request body:', req.body);
    console.log('Profile photo upload file:', (req as any).file);
    console.log('Request body keys:', Object.keys(req.body || {}));
    console.log('userId from body:', req.body?.userId);
    console.log('userId type:', typeof req.body?.userId);
    
    // Try to get userId from body (FormData fields should be in req.body with multer)
    let userId = req.body?.userId;
    
    // If userId is an array (sometimes FormData can create arrays), take the first element
    if (Array.isArray(userId)) {
      userId = userId[0];
    }
    
    // Convert to string if it's not already
    if (userId !== undefined && userId !== null) {
      userId = String(userId);
    }
    
    if (!userId || userId.trim() === '') {
      console.error('Invalid userId:', userId);
      console.error('Full req.body:', JSON.stringify(req.body, null, 2));
      // Clean up uploaded file if userId is missing
      if ((req as any).file) {
        fs.unlinkSync((req as any).file.path);
      }
      return res.status(400).json({ message: 'User ID is required and must be a valid string' });
    }
    
    // Trim whitespace
    userId = userId.trim();

    const file = (req as any).file;
    
    // If no file uploaded, check if profilePhoto was sent as a string (for backward compatibility)
    if (!file) {
      const profilePhoto = req.body?.profilePhoto;
      if (profilePhoto) {
        let user;
        try {
          user = await User.findByIdAndUpdate(
            userId,
            { profilePhoto: profilePhoto || undefined },
            { new: true }
          );
        } catch (findError: any) {
          if (findError.name === 'CastError' || findError.message?.includes('ObjectId')) {
            console.error('Invalid user ID format:', userId);
            return res.status(400).json({ message: 'Invalid user ID format' });
          }
          throw findError;
        }

        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        return res.json({ 
          message: 'Profile photo updated', 
          profilePhoto: user.profilePhoto 
        });
      } else {
        return res.status(400).json({ message: 'No profile photo provided' });
      }
    }

    // File was uploaded - save the file path/URL
    // Construct URL using request protocol and host
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:5001';
    const apiUrl = `${protocol}://${host}`;
    const profilePhotoUrl = `${apiUrl}/uploads/${file.filename}`;

    // Delete old profile photo if it exists
    let user;
    try {
      user = await User.findById(userId);
    } catch (findError: any) {
      // Clean up uploaded file on error
      fs.unlinkSync(file.path);
      
      // Check if it's an ObjectId validation error
      if (findError.name === 'CastError' || findError.message?.includes('ObjectId')) {
        console.error('Invalid user ID format:', userId);
        return res.status(400).json({ message: 'Invalid user ID format' });
      }
      throw findError; // Re-throw if it's a different error
    }
    if (user?.profilePhoto) {
      try {
        // Extract filename from old photo URL
        const oldPhotoUrl = user.profilePhoto;
        const urlParts = oldPhotoUrl.split('/uploads/');
        if (urlParts.length > 1) {
          const oldFilename = urlParts[1];
          const oldPhotoFullPath = path.join(uploadsDir, oldFilename);
          if (fs.existsSync(oldPhotoFullPath)) {
            fs.unlinkSync(oldPhotoFullPath);
            console.log(`Deleted old profile photo: ${oldFilename}`);
          }
        }
      } catch (err) {
        console.error('Error deleting old profile photo:', err);
      }
    }

    // Update user with new profile photo URL
    // Let mongoose handle ID validation - it will throw an error if invalid
    let updatedUser;
    try {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { profilePhoto: profilePhotoUrl },
        { new: true }
      );
    } catch (findError: any) {
      // Clean up uploaded file on error
      fs.unlinkSync(file.path);
      
      // Check if it's an ObjectId validation error
      if (findError.name === 'CastError' || findError.message?.includes('ObjectId')) {
        console.error('Invalid user ID format:', userId);
        return res.status(400).json({ message: 'Invalid user ID format' });
      }
      throw findError; // Re-throw if it's a different error
    }

    if (!updatedUser) {
      // Clean up uploaded file if user not found
      fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log(`Profile photo updated for user: ${userId}, file: ${file.filename}`);

    return res.json({ 
      message: 'Profile photo updated successfully', 
      profilePhoto: updatedUser.profilePhoto,
      profileImageUrl: updatedUser.profilePhoto // Alias for compatibility
    });
  } catch (err: any) {
    console.error('Profile photo update error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      userId: req.body?.userId,
      hasFile: !!(req as any).file,
    });
    
    // Clean up uploaded file on error
    if ((req as any).file) {
      try {
        fs.unlinkSync((req as any).file.path);
        console.log('Cleaned up uploaded file after error');
      } catch (unlinkErr) {
        console.error('Error cleaning up file:', unlinkErr);
      }
    }
    
    // Provide more specific error messages
    let errorMessage = 'Failed to update profile photo';
    if (err.message?.includes('ObjectId')) {
      errorMessage = 'Invalid user ID format';
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    return res.status(500).json({ 
      message: errorMessage,
      error: err.message || String(err)
    });
  }
});

// Update user profile
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Safely extract fields from req.body
    const body = req.body || {};
    const firstName = body.firstName;
    const lastName = body.lastName;
    const email = body.email;
    const phone = body.phone;
    const address = body.address;

    // Build update object with only provided fields
    const updateData: any = {};
    if (firstName !== undefined && firstName !== null) updateData.firstName = String(firstName).trim();
    if (lastName !== undefined && lastName !== null) updateData.lastName = String(lastName).trim();
    if (email !== undefined && email !== null) updateData.email = String(email).toLowerCase().trim();
    if (phone !== undefined && phone !== null) {
      const phoneStr = String(phone).trim();
      updateData.phone = phoneStr || undefined;
    }
    if (address !== undefined && address !== null) {
      const addressStr = String(address).trim();
      updateData.address = addressStr || undefined;
    }

    // Validate user ID is provided
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Check if there's any data to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields provided to update' });
    }

    // Let mongoose handle ID validation
    let user;
    try {
      user = await User.findByIdAndUpdate(
        id.trim(),
        updateData,
        { new: true, runValidators: true }
      );
    } catch (findError: any) {
      // Check if it's an ObjectId validation error
      if (findError.name === 'CastError' || findError.message?.includes('ObjectId')) {
        console.error('Invalid user ID format:', id);
        return res.status(400).json({ message: 'Invalid user ID format' });
      }
      throw findError; // Re-throw if it's a different error
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      _id: user._id,
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      profilePhoto: user.profilePhoto,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    console.error('Profile update error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      body: req.body,
      params: req.params,
    });
    
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    
    // Provide more specific error message
    let errorMessage = 'Failed to update profile';
    if (err.message?.includes('validation')) {
      errorMessage = 'Validation error: ' + err.message;
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    return res.status(500).json({ 
      message: errorMessage, 
      error: err.message || String(err) 
    });
  }
});

// Admin registration
router.post('/admin/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const [firstName, ...lastNameParts] = name.trim().split(' ');
    const lastName = lastNameParts.join(' ') || firstName;

    const admin = await User.create({
      username: firstName.toLowerCase(),
      firstName,
      lastName,
      email: normalizedEmail,
      password,
      role: 'admin',
    });

    return res.status(201).json({
      id: admin.id,
      email: admin.email,
      name: `${admin.firstName} ${admin.lastName}`,
      role: admin.role,
    });
  } catch (err) {
    console.error('Admin registration error:', err);
    return res.status(500).json({ message: 'Registration failed', error: String(err) });
  }
});

// Admin login
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }


    const admin = await User.findOne({
      email: email.toLowerCase().trim(), 
      role: 'admin'  
    });

    console.log('Admin:', admin, password);
    if (!admin || admin.password !== password) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    // Log admin login activity
    await logAdminActivity(
      admin.id,
      'admin_login',
      `Admin ${admin.firstName} ${admin.lastName} logged in via dashboard`,
      admin.id,
      'user'
    );

    return res.json({
      id: admin.id,
      email: admin.email,
      name: `${admin.firstName} ${admin.lastName}`,
      phone: admin.phone || null,
      address: admin.address || null,
      role: admin.role,
      profileImage: admin.profilePhoto || null, // Include profile image in response
      createdAt: admin.createdAt,
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ message: 'Login failed', error: String(err) });
  }
});

// Google Sign-In for regular users
router.post('/google-login', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ message: 'ID token is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    
    if (!payload || !payload.email) {
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    const { email, given_name, family_name, picture, sub: googleId } = payload;

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create new user with Google data
      user = await User.create({
        email: email.toLowerCase(),
        firstName: given_name || 'User',
        lastName: family_name || '',
        username: email.split('@')[0],
        password: crypto.randomBytes(32).toString('hex'), // Random password for Google users
        profilePhoto: picture || null,
        googleId,
      });
    } else {
      // Update existing user's Google info
      user.googleId = googleId;
      if (picture) user.profilePhoto = picture;
      await user.save();
    }

    return res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePhoto: user.profilePhoto,
      role: user.role,
    });
  } catch (err) {
    console.error('Google login error:', err);
    return res.status(500).json({ message: 'Google authentication failed', error: String(err) });
  }
});

// Google Sign-In for admin
router.post('/admin/google-login', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ message: 'ID token is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    
    if (!payload || !payload.email) {
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    const { email, given_name, family_name, picture, sub: googleId } = payload;

    // Check if admin exists
    let admin = await User.findOne({ 
      email: email.toLowerCase(), 
      role: 'admin' 
    });

    if (!admin) {
      // Don't auto-create admin accounts - must be created manually
      return res.status(403).json({ 
        message: 'No admin account found with this Google account. Please contact administrator.' 
      });
    }

    // Update admin's Google info
    admin.googleId = googleId;
    if (picture) admin.profilePhoto = picture;
    await admin.save();

    // Log admin login activity
    await logAdminActivity(
      admin.id,
      'admin_login',
      `Admin ${admin.firstName} ${admin.lastName} logged in via Google`,
      admin.id,
      'user'
    );

    return res.json({
      id: admin.id,
      email: admin.email,
      name: `${admin.firstName} ${admin.lastName}`,
      role: admin.role,
      profileImage: admin.profilePhoto || null,
      createdAt: admin.createdAt,
    });
  } catch (err) {
    console.error('Google admin login error:', err);
    return res.status(500).json({ message: 'Google authentication failed', error: String(err) });
  }
});

// Get all users (admin only)
router.get('/all', async (req: Request, res: Response) => {
  try {
    const users = await User.find({}, '-password -resetToken -otpCode').sort({ createdAt: -1 });
    return res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Delete a single user (admin only)
router.delete('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Prevent deleting admin users
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin users' });
    }
    
    await User.findByIdAndDelete(userId);
    
    // Log admin activity (if adminId is available from auth middleware)
    try {
      const adminId = (req as any).user?.id || (req as any).admin?.id;
      if (adminId) {
        await logAdminActivity(
          adminId,
          'delete',
          `Deleted user: ${user.firstName} ${user.lastName} (${user.email})`,
          userId,
          'user'
        );
      }
    } catch (logError) {
      console.warn('Could not log admin activity:', logError);
    }
    
    return res.json({ message: 'User deleted successfully', deletedUserId: userId });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ message: 'Failed to delete user' });
  }
});

// Delete all users (admin only) - excludes admin users
router.delete('/all', async (req: Request, res: Response) => {
  try {
    const result = await User.deleteMany({ role: { $ne: 'admin' } });
    
    // Log admin activity (if adminId is available from auth middleware)
    try {
      const adminId = (req as any).user?.id || (req as any).admin?.id;
      if (adminId) {
        await logAdminActivity(
          adminId,
          'delete_all',
          `Deleted all users (${result.deletedCount} users)`,
          undefined,
          'user'
        );
      }
    } catch (logError) {
      console.warn('Could not log admin activity:', logError);
    }
    
    return res.json({ 
      message: 'All users deleted successfully', 
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error('Delete all users error:', err);
    return res.status(500).json({ message: 'Failed to delete all users' });
  }
});

export default router;


