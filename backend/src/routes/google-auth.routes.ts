import { Router } from 'express';
import { User } from '../models/User.model';

const router = Router();

// Google OAuth flow - exchange code for user info
router.post('/google-oauth', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      return res.status(400).json({ message: 'Failed to exchange code for token' });
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userResponse.json();

    if (!userResponse.ok) {
      console.error('User info error:', googleUser);
      return res.status(400).json({ message: 'Failed to get user info from Google' });
    }

    // Check if user already exists with this Google ID or email
    let user = await User.findOne({
      $or: [
        { googleId: googleUser.id },
        { email: googleUser.email }
      ]
    });

    if (user) {
      // Update existing user's Google info if needed
      if (!user.googleId) {
        user.googleId = googleUser.id;
      }
      if (googleUser.picture && !user.profilePhoto) {
        user.profilePhoto = googleUser.picture;
      }
      await user.save();
    } else {
      // Create new user
      user = new User({
        googleId: googleUser.id,
        email: googleUser.email,
        username: googleUser.email,
        firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || '',
        lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
        name: googleUser.name || `${googleUser.given_name || ''} ${googleUser.family_name || ''}`.trim(),
        profilePhoto: googleUser.picture,
        role: 'user',
        password: 'google-auth', // Placeholder password for Google users
      });
      await user.save();
    }

    // Return user data for frontend
    res.json({
      id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      role: user.role,
      profilePhoto: user.profilePhoto,
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Legacy Google login endpoint (keep for compatibility)
router.post('/google-login', async (req, res) => {
  try {
    const { googleId, email, name, firstName, lastName, profilePhoto } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({ message: 'Google ID and email are required' });
    }

    let user = await User.findOne({
      $or: [{ googleId }, { email }]
    });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (profilePhoto && !user.profilePhoto) {
        user.profilePhoto = profilePhoto;
      }
      await user.save();
    } else {
      user = new User({
        googleId,
        email,
        username: email,
        firstName: firstName || name?.split(' ')[0] || '',
        lastName: lastName || name?.split(' ').slice(1).join(' ') || '',
        name: name || `${firstName || ''} ${lastName || ''}`.trim(),
        profilePhoto,
        role: 'user',
        password: 'google-auth',
      });
      await user.save();
    }

    res.json({
      id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      role: user.role,
      profilePhoto: user.profilePhoto,
    });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export { router as googleAuthRoutes };