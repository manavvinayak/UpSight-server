const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const auth = require('../middleware/auth');
const upload = require('../config/multer');
const cloudinary = require('../config/cloudinary');

// Upload a new document with original and processed images
router.post('/upload', auth, upload.fields([
  { name: 'original', maxCount: 1 },
  { name: 'processed', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.original || !req.files.processed) {
      return res.status(400).json({ error: 'Both original and processed images are required' });
    }

    const originalFile = req.files.original[0];
    const processedFile = req.files.processed[0];

    const document = new Document({
      user: req.userId,
      originalImage: {
        url: originalFile.path,
        publicId: originalFile.filename
      },
      processedImage: {
        url: processedFile.path,
        publicId: processedFile.filename
      },
      fileName: req.body.fileName || originalFile.originalname,
      fileSize: originalFile.size,
      mimeType: originalFile.mimetype
    });

    await document.save();
    res.status(201).json(document);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Get all documents for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const documents = await Document.find({ user: req.userId })
      .sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get a single document by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Fetch document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Delete a document
router.delete('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete images from Cloudinary
    await Promise.all([
      cloudinary.uploader.destroy(document.originalImage.publicId),
      cloudinary.uploader.destroy(document.processedImage.publicId)
    ]);

    // Delete document from database
    await Document.deleteOne({ _id: req.params.id });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
