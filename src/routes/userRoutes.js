import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Create or find user profile
router.post('/sync-user', async (req, res) => {
  const { clerkId, username, profileImageUrl, email } = req.body;

  try {
    const user = await prisma.userProfile.upsert({
      where: { clerkId },
      update: {
        username,
        profilePic: profileImageUrl,
        email,
      },
      create: {
        clerkId,
        username,
        profilePic: profileImageUrl,
        email,
      },
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error syncing user' });
  }
});

// Get user profile by Clerk ID
router.get('/:clerkId', async (req, res) => {
  const { clerkId } = req.params;

  try {
    const user = await prisma.userProfile.findUnique({
      where: { clerkId },
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// Update username by user ID or Clerk ID
router.put('/:id/username', async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username || username.length < 3 || username.length > 20) {
    return res.status(400).json({ message: 'Invalid username length' });
  }
  try {
    // Try updating by numeric ID first, then by clerkId if that fails
    let updated;
    try {
      updated = await prisma.userProfile.update({
        where: { id: isNaN(Number(id)) ? undefined : Number(id) },
        data: { username },
      });
    } catch (e) {
      // If not found by numeric ID, try by clerkId
      updated = await prisma.userProfile.update({
        where: { clerkId: id },
        data: { username },
      });
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating username. User not found or database error.' });
  }
});

// Migrate guest data to a new user account
router.post('/:clerkId/migrate-guest-data', async (req, res) => {
  const { clerkId } = req.params;
  const { username, gamesPlayed, gamesWon, totalScore, highestScore } = req.body;

  try {
    // Update the user profile with guest data
    const updatedUser = await prisma.userProfile.update({
      where: { clerkId },
      data: {
        username: username || undefined, // Only update if provided
        gamesPlayed: gamesPlayed || 0,
        gamesWon: gamesWon || 0,
        gamesLost: (gamesPlayed || 0) - (gamesWon || 0), // Calculate games lost
      },
    });

    res.json({ 
      message: 'Guest data migrated successfully',
      user: updatedUser 
    });
  } catch (error) {
    console.error('Error migrating guest data:', error);
    res.status(500).json({ message: 'Error migrating guest data' });
  }
});

export default router;
