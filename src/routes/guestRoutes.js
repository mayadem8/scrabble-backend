import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

function generateGuestName() {
  const adjectives = ['Swift', 'Clever', 'Brave', 'Lucky', 'Mighty', 'Quick', 'Bright', 'Calm', 'Bold', 'Witty'];
  const animals = ['Fox', 'Hawk', 'Bear', 'Wolf', 'Lion', 'Tiger', 'Eagle', 'Otter', 'Owl', 'Shark'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(1000 + Math.random() * 9000);
  return `${adj}${animal}${number}`;
}

function generateGuestEmail(guestName) {
  return `${guestName.toLowerCase()}@guest.yourdomain.com`;
}

function generateGuestPassword() {
  return Math.random().toString(36).slice(-10) + 'A1!'; // random + strong
}

// POST /guest - create a guest user in Clerk and return a sign-in link/token
router.post('/guest', async (req, res) => {
  const guestName = generateGuestName();
  const guestEmail = generateGuestEmail(guestName);
  const guestPassword = generateGuestPassword();
  try {
    // Create Clerk user
    const userRes = await axios.post(
      'https://api.clerk.dev/v1/users',
      {
        username: guestName,
        first_name: 'Guest',
        last_name: guestName,
        email_address: [guestEmail],
        password: guestPassword,
        public_metadata: { isGuest: true },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    // Create sign-in token using the correct endpoint
    const tokenRes = await axios.post(
      'https://api.clerk.dev/v1/sign_in_tokens',
      {
        user_id: userRes.data.id,
        expires_in_seconds: 604800 // 7 days
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    res.json({ token: tokenRes.data.token });
  } catch (err) {
    console.error('Guest creation failed:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to create guest user' });
  }
});

export default router;
