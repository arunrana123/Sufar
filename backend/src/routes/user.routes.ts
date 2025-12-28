// USER ROUTES - Handles user authentication, profile management, and Google OAuth
// Endpoints: POST /register, POST /login, POST /google-auth, GET /:id, PUT /:id, POST /forgot-password
// Features: User registration/login, Google Sign-In, profile updates, password reset
import { Router, type Request, type Response } from "express";
import User from "../models/User.model";
import crypto from 'crypto';
import { logAdminActivity } from "./dashboard.routes";
import { OAuth2Client } from 'google-auth-library';
import { sendUserOTPEmail } from '../utils/userEmailService';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Register new user (basic, no hashing yet; add hashing later)
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, firstName, lastName, email, password } = req.body;
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
    const { identifier, password } = req.body as { identifier?: string; password?: string };
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

// Update user profile
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, address } = req.body;

    // Build update object with only provided fields
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (phone !== undefined) updateData.phone = phone.trim() || undefined;
    if (address !== undefined) updateData.address = address.trim() || undefined;

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

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
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    return res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// Update profile photo
router.patch('/profile-photo', async (req: Request, res: Response) => {
  try {
    const { userId, profilePhoto } = req.body as { userId?: string; profilePhoto?: string | null };
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { profilePhoto: profilePhoto || undefined },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ 
      message: 'Profile photo updated', 
      profilePhoto: user.profilePhoto 
    });
  } catch (err) {
    console.error('Profile photo update error:', err);
    return res.status(500).json({ message: 'Failed to update profile photo' });
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


