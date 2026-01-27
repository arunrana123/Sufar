import express, { Request, Response } from 'express';
import Product from '../models/Product.model';

const router = express.Router();

// GET /api/market/products - Get all products (for user app and admin)
router.get('/products', async (req: Request, res: Response) => {
  try {
    const { category, search, popular, recommended, includeInactive } = req.query;
    
    // By default, only show active products (for user app)
    // Admin can pass includeInactive=true to see all products
    const query: any = includeInactive !== 'true' ? { isActive: true } : {};
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { label: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (popular === 'true') {
      query.isPopular = true;
    }
    
    if (recommended === 'true') {
      query.isRecommended = true;
    }
    
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ products });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
});

// GET /api/market/products/:id - Get single product
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json({ product });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
});

// POST /api/market/products - Create new product (admin only)
router.post('/products', async (req: Request, res: Response) => {
  try {
    const {
      name,
      label,
      price,
      originalPrice,
      discount,
      images,
      videoUrl,
      category,
      description,
      deliveryLocation,
      phoneNumber,
      inStock,
      rating,
      reviewCount,
      isPopular,
      isRecommended,
    } = req.body;
    
    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }
    
    const product = new Product({
      name,
      label,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
      discount: discount ? parseFloat(discount) : undefined,
      images: images || [],
      videoUrl,
      category,
      description,
      deliveryLocation,
      phoneNumber,
      inStock: inStock !== undefined ? inStock : true,
      rating: rating ? parseFloat(rating) : 0,
      reviewCount: reviewCount ? parseInt(reviewCount) : 0,
      isPopular: isPopular || false,
      isRecommended: isRecommended || false,
      isActive: true,
    });
    
    await product.save();
    
    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
});

// PUT /api/market/products/:id - Update product (admin only)
router.put('/products/:id', async (req: Request, res: Response) => {
  try {
    const {
      name,
      label,
      price,
      originalPrice,
      discount,
      images,
      videoUrl,
      category,
      description,
      deliveryLocation,
      phoneNumber,
      inStock,
      rating,
      reviewCount,
      isPopular,
      isRecommended,
      isActive,
    } = req.body;
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Update fields
    if (name !== undefined) product.name = name;
    if (label !== undefined) product.label = label;
    if (price !== undefined) product.price = parseFloat(price);
    if (originalPrice !== undefined) product.originalPrice = originalPrice ? parseFloat(originalPrice) : undefined;
    if (discount !== undefined) product.discount = discount ? parseFloat(discount) : undefined;
    if (images !== undefined) product.images = images;
    if (videoUrl !== undefined) product.videoUrl = videoUrl;
    if (category !== undefined) product.category = category;
    if (description !== undefined) product.description = description;
    if (deliveryLocation !== undefined) product.deliveryLocation = deliveryLocation;
    if (phoneNumber !== undefined) product.phoneNumber = phoneNumber;
    if (inStock !== undefined) product.inStock = inStock;
    if (rating !== undefined) product.rating = parseFloat(rating);
    if (reviewCount !== undefined) product.reviewCount = parseInt(reviewCount);
    if (isPopular !== undefined) product.isPopular = isPopular;
    if (isRecommended !== undefined) product.isRecommended = isRecommended;
    if (isActive !== undefined) product.isActive = isActive;
    
    await product.save();
    
    res.json({ message: 'Product updated successfully', product });
  } catch (error: any) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
});

// DELETE /api/market/products/:id - Delete product (admin only - soft delete)
router.delete('/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Soft delete - set isActive to false
    product.isActive = false;
    await product.save();
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
});

// GET /api/market/categories - Get all product categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json({ categories });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
});

export default router;
