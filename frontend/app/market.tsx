// MARKET SCREEN - On Tap Magic World Market Page
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart } from '@/contexts/CartContext';
import { getApiUrl } from '@/lib/config';

interface Product {
  _id: string;
  name: string;
  label?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  images: string[];
  videoUrl?: string;
  category: string;
  description?: string;
  deliveryLocation?: string;
  phoneNumber?: string;
  inStock?: boolean;
  rating?: number;
  reviewCount?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
}

function getDefaultMarketProducts(): Product[] {
  return [
    { _id: '1', name: 'Cotton T-Shirt', label: 'Premium Cotton T-Shirt', price: 899, originalPrice: 1299, discount: 30, images: ['https://via.placeholder.com/300'], category: 'Clothes', inStock: true, rating: 4.5, reviewCount: 120, isPopular: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234567' },
    { _id: '2', name: 'Wooden Chair', label: 'Modern Wooden Chair', price: 2500, images: ['https://via.placeholder.com/300'], category: 'Furnitures', inStock: true, rating: 4.8, reviewCount: 45, isRecommended: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234567', description: 'Comfortable modern wooden chair' },
    { _id: '3', name: 'Bulk Vegetables', label: 'Fresh Vegetables - 50 kg', price: 2500, originalPrice: 3000, discount: 16, images: ['https://via.placeholder.com/300'], category: 'Wholesale', inStock: true, rating: 4.7, reviewCount: 80, isPopular: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234567', description: 'Fresh vegetables in bulk - 50 kg pack' },
    { _id: '4', name: 'Office Desk', label: 'Modern Office Desk', price: 3500, images: ['https://via.placeholder.com/300'], category: 'Furnitures', inStock: true, rating: 4.6, reviewCount: 30, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234567' },
    { _id: '5', name: 'Rice - 1 Quintal', label: 'Premium Rice - 1 Quintal (100 kg)', price: 8000, images: ['https://via.placeholder.com/300'], category: 'Wholesale', inStock: true, rating: 4.8, reviewCount: 120, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234568', description: 'High quality rice - 1 quintal (100 kg)' },
    { _id: '6', name: 'Live Chicken', label: 'Live Chicken - Bulk Order', price: 350, images: ['https://via.placeholder.com/300'], category: 'Wholesale', inStock: true, rating: 4.6, reviewCount: 45, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234569', description: 'Fresh live chicken - per kg' },
    { _id: '7', name: 'Bulk Meat', label: 'Fresh Meat - 20 kg', price: 12000, images: ['https://via.placeholder.com/300'], category: 'Wholesale', inStock: true, rating: 4.9, reviewCount: 200, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234570', description: 'Fresh meat - 20 kg pack' },
    { _id: '8', name: 'Potatoes - 1 Quintal', label: 'Fresh Potatoes - 1 Quintal', price: 3000, images: ['https://via.placeholder.com/300'], category: 'Wholesale', inStock: true, rating: 4.5, reviewCount: 90, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234571', description: 'Fresh potatoes - 1 quintal (100 kg)' },
    { _id: '9', name: 'King Size Bed', label: 'King Size Bed with Mattress', price: 45000, originalPrice: 55000, discount: 18, images: ['https://via.placeholder.com/300'], category: 'Furnitures', inStock: true, rating: 4.9, reviewCount: 150, isPopular: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234572', description: 'Premium king size bed with comfortable mattress' },
    { _id: '10', name: 'Low Bed', label: 'Modern Low Bed Frame', price: 12000, images: ['https://via.placeholder.com/300'], category: 'Furnitures', inStock: true, rating: 4.6, reviewCount: 80, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234573', description: 'Stylish low bed frame for modern bedrooms' },
    { _id: '11', name: 'Dining Table', label: 'Wooden Dining Table - 6 Seater', price: 18000, originalPrice: 22000, discount: 18, images: ['https://via.placeholder.com/300'], category: 'Furnitures', inStock: true, rating: 4.7, reviewCount: 95, isPopular: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234574', description: 'Solid wood dining table for 6 people' },
    { _id: '12', name: 'Cupboard', label: 'Wardrobe Cupboard - 4 Door', price: 25000, images: ['https://via.placeholder.com/300'], category: 'Furnitures', inStock: true, rating: 4.8, reviewCount: 120, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234575', description: 'Spacious 4-door wardrobe cupboard' },
    { _id: '19', name: 'Hammer Set', label: 'Professional Hammer Set - 3 Pieces', price: 1200, originalPrice: 1500, discount: 20, images: ['https://via.placeholder.com/300'], category: 'Hardware', inStock: true, rating: 4.7, reviewCount: 85, isPopular: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234582', description: 'Professional quality hammer set' },
    { _id: '20', name: 'Screwdriver Set', label: 'Multi-Purpose Screwdriver Set - 20 Pieces', price: 800, images: ['https://via.placeholder.com/300'], category: 'Hardware', inStock: true, rating: 4.6, reviewCount: 120, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234583', description: 'Complete screwdriver set' },
    { _id: '23', name: 'Drill Machine', label: 'Electric Drill Machine - 500W', price: 4500, originalPrice: 5500, discount: 18, images: ['https://via.placeholder.com/300'], category: 'Hardware', inStock: true, rating: 4.8, reviewCount: 150, isPopular: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234586', description: 'Powerful electric drill machine' },
    { _id: '49', name: 'Local Eggs', label: 'Fresh Local Eggs - 30 Pieces', price: 450, images: ['https://via.placeholder.com/300'], category: 'Farm', inStock: true, rating: 4.6, reviewCount: 150, isPopular: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234611', description: 'Fresh local eggs - 30 pieces per tray' },
    { _id: '50', name: 'Organic Eggs', label: 'Organic Free Range Eggs - 30 Pieces', price: 650, originalPrice: 750, discount: 13, images: ['https://via.placeholder.com/300'], category: 'Farm', inStock: true, rating: 4.8, reviewCount: 200, isPopular: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234612', description: 'Premium organic eggs - 30 pieces' },
    { _id: '55', name: 'Tomato - Carton', label: 'Fresh Tomatoes - 1 Carton (20 kg)', price: 1200, originalPrice: 1400, discount: 14, images: ['https://via.placeholder.com/300'], category: 'Farm', inStock: true, rating: 4.7, reviewCount: 180, isPopular: true, deliveryLocation: 'Kathmandu', phoneNumber: '+977-9841234617', description: 'Fresh red tomatoes - 1 carton (20 kg)' },
  ];
}

export function getMarketMockProductById(id: string): Product | null {
  const list = getDefaultMarketProducts();
  return list.find((p) => p._id === id) || null;
}

export default function MarketScreen() {
  const { theme } = useTheme();
  const { getTotalItems } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      let list: Product[] = [];
      try {
        const response = await fetch(`${apiUrl}/api/market/products`);
        if (response.ok) {
          const data = await response.json();
          list = data.products || [];
        }
      } catch (_) {
        // Network or API error - will use default content below
      }
      if (list.length > 0) {
        setProducts(list);
        const productCategories = list.map((p: Product) => String(p.category || ''));
        setCategories(Array.from(new Set(productCategories)) as string[]);
      } else {
        // Default content so Popular, Wholesale, Furnitures, Hardware, Farm are never empty
        const mockProducts: Product[] = [
          {
            _id: '1',
            name: 'Cotton T-Shirt',
            label: 'Premium Cotton T-Shirt',
            price: 899,
            originalPrice: 1299,
            discount: 30,
            images: ['https://via.placeholder.com/300'],
            category: 'Clothes',
            inStock: true,
            rating: 4.5,
            reviewCount: 120,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234567',
          },
          {
            _id: '2',
            name: 'Wooden Chair',
            label: 'Modern Wooden Chair',
            price: 2500,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.8,
            reviewCount: 45,
            isRecommended: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234567',
            description: 'Comfortable modern wooden chair',
          },
          {
            _id: '9',
            name: 'King Size Bed',
            label: 'King Size Bed with Mattress',
            price: 45000,
            originalPrice: 55000,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.9,
            reviewCount: 150,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234572',
            description: 'Premium king size bed with comfortable mattress',
          },
          {
            _id: '10',
            name: 'Low Bed',
            label: 'Modern Low Bed Frame',
            price: 12000,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.6,
            reviewCount: 80,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234573',
            description: 'Stylish low bed frame for modern bedrooms',
          },
          {
            _id: '11',
            name: 'Dining Table',
            label: 'Wooden Dining Table - 6 Seater',
            price: 18000,
            originalPrice: 22000,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.7,
            reviewCount: 95,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234574',
            description: 'Solid wood dining table for 6 people',
          },
          {
            _id: '12',
            name: 'Cupboard',
            label: 'Wardrobe Cupboard - 4 Door',
            price: 25000,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.8,
            reviewCount: 120,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234575',
            description: 'Spacious 4-door wardrobe cupboard',
          },
          {
            _id: '13',
            name: 'Study Table',
            label: 'Study Table with Drawer',
            price: 5500,
            originalPrice: 6500,
            discount: 15,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.5,
            reviewCount: 60,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234576',
            description: 'Ergonomic study table with storage drawer',
          },
          {
            _id: '14',
            name: 'Window Frame',
            label: 'Aluminum Window Frame',
            price: 3500,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.4,
            reviewCount: 40,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234577',
            description: 'Durable aluminum window frame',
          },
          {
            _id: '15',
            name: 'Door',
            label: 'Wooden Main Door',
            price: 15000,
            originalPrice: 18000,
            discount: 16,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.6,
            reviewCount: 70,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234578',
            description: 'Solid wooden main door with lock',
          },
          {
            _id: '16',
            name: 'Basket',
            label: 'Woven Storage Basket',
            price: 800,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.3,
            reviewCount: 35,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234579',
            description: 'Handwoven storage basket for home organization',
          },
          {
            _id: '17',
            name: 'Office Chair',
            label: 'Ergonomic Office Chair',
            price: 4500,
            originalPrice: 5500,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.7,
            reviewCount: 110,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234580',
            description: 'Comfortable ergonomic office chair with adjustable height',
          },
          {
            _id: '18',
            name: 'Coffee Table',
            label: 'Modern Coffee Table',
            price: 6500,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.5,
            reviewCount: 55,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234581',
            description: 'Stylish coffee table for living room',
          },
          {
            _id: '3',
            name: 'Bulk Vegetables',
            label: 'Fresh Vegetables - 50 kg',
            price: 2500,
            originalPrice: 3000,
            discount: 16,
            images: ['https://via.placeholder.com/300'],
            category: 'Wholesale',
            inStock: true,
            rating: 4.7,
            reviewCount: 80,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234567',
            description: 'Fresh vegetables in bulk - 50 kg pack',
          },
          {
            _id: '5',
            name: 'Rice - 1 Quintal',
            label: 'Premium Rice - 1 Quintal (100 kg)',
            price: 8000,
            images: ['https://via.placeholder.com/300'],
            category: 'Wholesale',
            inStock: true,
            rating: 4.8,
            reviewCount: 120,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234568',
            description: 'High quality rice - 1 quintal (100 kg)',
          },
          {
            _id: '6',
            name: 'Live Chicken',
            label: 'Live Chicken - Bulk Order',
            price: 350,
            images: ['https://via.placeholder.com/300'],
            category: 'Wholesale',
            inStock: true,
            rating: 4.6,
            reviewCount: 45,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234569',
            description: 'Fresh live chicken - per kg',
          },
          {
            _id: '7',
            name: 'Bulk Meat',
            label: 'Fresh Meat - 20 kg',
            price: 12000,
            images: ['https://via.placeholder.com/300'],
            category: 'Wholesale',
            inStock: true,
            rating: 4.9,
            reviewCount: 200,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234570',
            description: 'Fresh meat - 20 kg pack',
          },
          {
            _id: '8',
            name: 'Potatoes - 1 Quintal',
            label: 'Fresh Potatoes - 1 Quintal',
            price: 3000,
            images: ['https://via.placeholder.com/300'],
            category: 'Wholesale',
            inStock: true,
            rating: 4.5,
            reviewCount: 90,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234571',
            description: 'Fresh potatoes - 1 quintal (100 kg)',
          },
          {
            _id: '4',
            name: 'Office Desk',
            label: 'Modern Office Desk',
            price: 3500,
            images: ['https://via.placeholder.com/300'],
            category: 'Furnitures',
            inStock: true,
            rating: 4.6,
            reviewCount: 30,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234567',
          },
          // Hardware Items
          {
            _id: '19',
            name: 'Hammer Set',
            label: 'Professional Hammer Set - 3 Pieces',
            price: 1200,
            originalPrice: 1500,
            discount: 20,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.7,
            reviewCount: 85,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234582',
            description: 'Professional quality hammer set with different sizes',
          },
          {
            _id: '20',
            name: 'Screwdriver Set',
            label: 'Multi-Purpose Screwdriver Set - 20 Pieces',
            price: 800,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.6,
            reviewCount: 120,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234583',
            description: 'Complete screwdriver set with various sizes',
          },
          {
            _id: '21',
            name: 'Paint - White',
            label: 'Premium White Paint - 5 Liters',
            price: 1800,
            originalPrice: 2200,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.5,
            reviewCount: 95,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234584',
            description: 'High quality white paint for interior and exterior',
          },
          {
            _id: '22',
            name: 'Nails - Assorted',
            label: 'Steel Nails - Assorted Sizes (1 kg)',
            price: 250,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.4,
            reviewCount: 60,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234585',
            description: 'Assorted steel nails in various sizes',
          },
          {
            _id: '23',
            name: 'Drill Machine',
            label: 'Electric Drill Machine - 500W',
            price: 4500,
            originalPrice: 5500,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.8,
            reviewCount: 150,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234586',
            description: 'Powerful electric drill machine with accessories',
          },
          {
            _id: '24',
            name: 'Wrench Set',
            label: 'Adjustable Wrench Set - 5 Pieces',
            price: 1500,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.6,
            reviewCount: 75,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234587',
            description: 'Professional wrench set for various applications',
          },
          {
            _id: '25',
            name: 'Wire - Electrical',
            label: 'Electrical Wire - 100 meters',
            price: 3500,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.7,
            reviewCount: 110,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234588',
            description: 'Quality electrical wire for home wiring',
          },
          {
            _id: '26',
            name: 'Pliers Set',
            label: 'Professional Pliers Set - 4 Pieces',
            price: 900,
            originalPrice: 1100,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.5,
            reviewCount: 80,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234589',
            description: 'Complete pliers set for electrical and mechanical work',
          },
          {
            _id: '34',
            name: 'Saw - Hand',
            label: 'Hand Saw - 24 inches',
            price: 650,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.5,
            reviewCount: 65,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234596',
            description: 'Sharp hand saw for cutting wood and other materials',
          },
          {
            _id: '35',
            name: 'Paint - Blue',
            label: 'Premium Blue Paint - 5 Liters',
            price: 1900,
            originalPrice: 2300,
            discount: 17,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.6,
            reviewCount: 88,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234597',
            description: 'High quality blue paint for interior and exterior',
          },
          {
            _id: '36',
            name: 'Paint - Red',
            label: 'Premium Red Paint - 5 Liters',
            price: 1900,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.5,
            reviewCount: 72,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234598',
            description: 'Vibrant red paint for interior and exterior use',
          },
          {
            _id: '37',
            name: 'Bathroom Faucet',
            label: 'Modern Bathroom Faucet - Chrome',
            price: 2800,
            originalPrice: 3500,
            discount: 20,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.7,
            reviewCount: 95,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234599',
            description: 'Stylish chrome bathroom faucet with modern design',
          },
          {
            _id: '38',
            name: 'Shower Head',
            label: 'Rain Shower Head - 8 inches',
            price: 2200,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.6,
            reviewCount: 78,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234600',
            description: 'Large rain shower head for luxurious bathing experience',
          },
          {
            _id: '39',
            name: 'Bathroom Tiles',
            label: 'Ceramic Bathroom Tiles - 1 Box (10 sq ft)',
            price: 3200,
            originalPrice: 3800,
            discount: 15,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.8,
            reviewCount: 125,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234601',
            description: 'Premium ceramic tiles for bathroom walls and floors',
          },
          {
            _id: '40',
            name: 'Toilet Seat',
            label: 'Soft Close Toilet Seat - White',
            price: 1500,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.4,
            reviewCount: 55,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234602',
            description: 'Comfortable soft-close toilet seat with easy installation',
          },
          {
            _id: '41',
            name: 'Bathroom Mirror',
            label: 'LED Bathroom Mirror - 24x36 inches',
            price: 4500,
            originalPrice: 5500,
            discount: 18,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.7,
            reviewCount: 92,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234603',
            description: 'Modern LED bathroom mirror with touch control',
          },
          {
            _id: '42',
            name: 'Pipe Fittings',
            label: 'PVC Pipe Fittings Set - 20 Pieces',
            price: 1200,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.5,
            reviewCount: 68,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234604',
            description: 'Complete set of PVC pipe fittings for plumbing',
          },
          {
            _id: '43',
            name: 'Screws - Assorted',
            label: 'Steel Screws - Assorted Sizes (500g)',
            price: 350,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.3,
            reviewCount: 45,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234605',
            description: 'Assorted steel screws in various sizes and types',
          },
          {
            _id: '44',
            name: 'Measuring Tape',
            label: 'Steel Measuring Tape - 5 meters',
            price: 400,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.6,
            reviewCount: 85,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234606',
            description: 'Durable steel measuring tape with lock mechanism',
          },
          {
            _id: '45',
            name: 'Level Tool',
            label: 'Spirit Level - 24 inches',
            price: 550,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.5,
            reviewCount: 58,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234607',
            description: 'Professional spirit level for accurate measurements',
          },
          {
            _id: '46',
            name: 'Paint Brush Set',
            label: 'Professional Paint Brush Set - 10 Pieces',
            price: 600,
            originalPrice: 750,
            discount: 20,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.4,
            reviewCount: 70,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234608',
            description: 'Complete set of paint brushes in various sizes',
          },
          {
            _id: '47',
            name: 'Sandpaper Set',
            label: 'Sandpaper Assortment - 20 Sheets',
            price: 450,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.3,
            reviewCount: 52,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234609',
            description: 'Assorted sandpaper sheets in different grits',
          },
          {
            _id: '48',
            name: 'Bathroom Towel Rack',
            label: 'Wall Mounted Towel Rack - Chrome',
            price: 1800,
            images: ['https://via.placeholder.com/300'],
            category: 'Hardware',
            inStock: true,
            rating: 4.6,
            reviewCount: 82,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234610',
            description: 'Stylish chrome towel rack for bathroom organization',
          },
          // Farm Suppliers - Edible Items Only (Eggs & Vegetables)
          // Eggs - Different Categories
          {
            _id: '49',
            name: 'Local Eggs',
            label: 'Fresh Local Eggs - 30 Pieces',
            price: 450,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.6,
            reviewCount: 150,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234611',
            description: 'Fresh local eggs from local farms - 30 pieces per tray',
          },
          {
            _id: '50',
            name: 'Organic Eggs',
            label: 'Organic Free Range Eggs - 30 Pieces',
            price: 650,
            originalPrice: 750,
            discount: 13,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.8,
            reviewCount: 200,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234612',
            description: 'Premium organic eggs from free range hens - 30 pieces',
          },
          {
            _id: '51',
            name: 'Free Range Hen Eggs',
            label: 'Free Range Hen Eggs - 30 Pieces',
            price: 550,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.7,
            reviewCount: 175,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234613',
            description: 'Fresh free range hen eggs - naturally raised - 30 pieces',
          },
          {
            _id: '52',
            name: 'Closed Farm Eggs',
            label: 'Closed Farm Eggs - 30 Pieces',
            price: 400,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.5,
            reviewCount: 120,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234614',
            description: 'Fresh eggs from closed farm system - 30 pieces',
          },
          {
            _id: '53',
            name: 'Chemical Free Eggs',
            label: 'Chemical Free Eggs - 30 Pieces',
            price: 600,
            originalPrice: 700,
            discount: 14,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.9,
            reviewCount: 220,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234615',
            description: '100% chemical free eggs from organic farms - 30 pieces',
          },
          {
            _id: '54',
            name: 'Local Eggs - Bulk',
            label: 'Fresh Local Eggs - 60 Pieces',
            price: 850,
            originalPrice: 900,
            discount: 5,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.6,
            reviewCount: 95,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234616',
            description: 'Fresh local eggs in bulk - 60 pieces per carton',
          },
          // Vegetables in Cartons
          {
            _id: '55',
            name: 'Tomato - Carton',
            label: 'Fresh Tomatoes - 1 Carton (20 kg)',
            price: 1200,
            originalPrice: 1400,
            discount: 14,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.7,
            reviewCount: 180,
            isPopular: true,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234617',
            description: 'Fresh red tomatoes - 1 carton (20 kg)',
          },
          {
            _id: '56',
            name: 'Potato - Carton',
            label: 'Fresh Potatoes - 1 Carton (25 kg)',
            price: 1500,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.6,
            reviewCount: 160,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234618',
            description: 'Fresh potatoes - 1 carton (25 kg)',
          },
          {
            _id: '57',
            name: 'Radish - Carton',
            label: 'Fresh Radish - 1 Carton (15 kg)',
            price: 800,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.5,
            reviewCount: 110,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234619',
            description: 'Fresh white radish - 1 carton (15 kg)',
          },
          {
            _id: '58',
            name: 'Onion - Carton',
            label: 'Fresh Onions - 1 Carton (20 kg)',
            price: 1800,
            originalPrice: 2000,
            discount: 10,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.7,
            reviewCount: 145,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234620',
            description: 'Fresh onions - 1 carton (20 kg)',
          },
          {
            _id: '59',
            name: 'Carrot - Carton',
            label: 'Fresh Carrots - 1 Carton (15 kg)',
            price: 1400,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.6,
            reviewCount: 130,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234621',
            description: 'Fresh carrots - 1 carton (15 kg)',
          },
          {
            _id: '60',
            name: 'Cabbage - Carton',
            label: 'Fresh Cabbage - 1 Carton (20 kg)',
            price: 1000,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.4,
            reviewCount: 100,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234622',
            description: 'Fresh cabbage - 1 carton (20 kg)',
          },
          {
            _id: '61',
            name: 'Cauliflower - Carton',
            label: 'Fresh Cauliflower - 1 Carton (15 kg)',
            price: 1600,
            originalPrice: 1800,
            discount: 11,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.6,
            reviewCount: 125,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234623',
            description: 'Fresh cauliflower - 1 carton (15 kg)',
          },
          {
            _id: '62',
            name: 'Spinach - Carton',
            label: 'Fresh Spinach - 1 Carton (10 kg)',
            price: 900,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.5,
            reviewCount: 85,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234624',
            description: 'Fresh spinach leaves - 1 carton (10 kg)',
          },
          {
            _id: '63',
            name: 'Green Beans - Carton',
            label: 'Fresh Green Beans - 1 Carton (12 kg)',
            price: 1100,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.5,
            reviewCount: 95,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234625',
            description: 'Fresh green beans - 1 carton (12 kg)',
          },
          {
            _id: '64',
            name: 'Cucumber - Carton',
            label: 'Fresh Cucumber - 1 Carton (15 kg)',
            price: 1300,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.6,
            reviewCount: 115,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234626',
            description: 'Fresh cucumbers - 1 carton (15 kg)',
          },
          {
            _id: '65',
            name: 'Bell Pepper - Carton',
            label: 'Fresh Bell Peppers - 1 Carton (10 kg)',
            price: 1700,
            originalPrice: 1900,
            discount: 10,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.7,
            reviewCount: 140,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234627',
            description: 'Fresh bell peppers (mixed colors) - 1 carton (10 kg)',
          },
          {
            _id: '66',
            name: 'Brinjal - Carton',
            label: 'Fresh Brinjal (Eggplant) - 1 Carton (15 kg)',
            price: 1200,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.5,
            reviewCount: 105,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234628',
            description: 'Fresh brinjal - 1 carton (15 kg)',
          },
          {
            _id: '67',
            name: 'Okra - Carton',
            label: 'Fresh Okra (Lady Finger) - 1 Carton (12 kg)',
            price: 1400,
            images: ['https://via.placeholder.com/300'],
            category: 'Farm',
            inStock: true,
            rating: 4.4,
            reviewCount: 90,
            deliveryLocation: 'Kathmandu',
            phoneNumber: '+977-9841234629',
            description: 'Fresh okra - 1 carton (12 kg)',
          },
        ];
        setProducts(mockProducts);
        setCategories(['Clothes', 'Furnitures', 'Wholesale', 'Electronics', 'Hardware', 'Farm']);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      const mockProducts = getDefaultMarketProducts();
      setProducts(mockProducts);
      setCategories(['Clothes', 'Furnitures', 'Wholesale', 'Hardware', 'Farm', 'Electronics']);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = searchQuery === '' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.label?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const popularProducts = filteredProducts.filter(p => p.isPopular || p.discount);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.replace('/home')}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText 
            type="title" 
            style={[styles.headerTitle, { color: '#fff' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            On Tap Market
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.background }]}>
          <View style={styles.searchBarRow}>
            <View style={[styles.searchBar, { backgroundColor: '#fff', borderColor: '#FF7A2C' }]}>
              <View style={styles.searchIconContainer}>
                <Ionicons name="search" size={20} color="#666" />
              </View>
              <TextInput
                style={[styles.searchInput, { color: '#333' }]}
                placeholder="Find your demand..."
                placeholderTextColor="rgba(0, 0, 0, 0.3)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity 
              style={[styles.cartIconContainer, { backgroundColor: '#FF7A2C' }]}
              onPress={() => router.push('/cart')}
            >
              <Ionicons name="cart" size={24} color="#fff" />
              {getTotalItems() > 0 && (
                <View style={styles.cartBadge}>
                  <ThemedText style={styles.cartBadgeText}>
                    {getTotalItems() > 99 ? '99+' : getTotalItems()}
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.text }]}>
              Loading products...
            </ThemedText>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Popular Section */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                Popular
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {popularProducts.length > 0 ? (
                  popularProducts.slice(0, 6).map((product) => (
                    <TouchableOpacity
                      key={product._id}
                      style={styles.placeholderCard}
                      onPress={() => router.push({
                        pathname: '/market-product',
                        params: { productId: product._id },
                      })}
                    >
                      <View style={styles.imageContainer}>
                        {product.images && product.images.length > 0 ? (
                          <Image
                            source={{ uri: product.images[0] }}
                            style={styles.placeholderImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.placeholderImage, { justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="image-outline" size={24} color="#999" />
                          </View>
                        )}
                        {product.discount && product.discount > 0 && (
                          <View style={styles.discountBadge}>
                            <ThemedText style={styles.discountText}>-{product.discount}%</ThemedText>
                          </View>
                        )}
                        {product.images && product.images.length > 1 && (
                          <View style={styles.imageCountBadge}>
                            <Ionicons name="images" size={10} color="#fff" />
                            <ThemedText style={styles.imageCountText}>{product.images.length}</ThemedText>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  // Placeholder cards
                  [1, 2, 3, 4].map((i) => (
                    <View key={i} style={styles.placeholderCard}>
                      <View style={styles.placeholderImage} />
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Whole sale Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  Whole sale
                </ThemedText>
                <TouchableOpacity onPress={() => router.push('/market-wholesale')}>
                  <ThemedText style={[styles.viewAllText, { color: theme.text }]}>
                    View All
                  </ThemedText>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {filteredProducts.filter(p => p.category === 'Wholesale' || !selectedCategory).slice(0, 6).map((product) => (
                  <TouchableOpacity 
                    key={product._id} 
                    style={[styles.wholesaleCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => router.push({
                      pathname: '/market-product',
                      params: { productId: product._id },
                    })}
                  >
                    <View style={styles.imageContainer}>
                      {product.images && product.images.length > 0 ? (
                        <Image
                          source={{ uri: product.images[0] }}
                          style={styles.wholesaleImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.wholesaleImage, { backgroundColor: '#E0E0E0' }]}>
                          <Ionicons name="image-outline" size={32} color="#999" />
                        </View>
                      )}
                      {product.discount && product.discount > 0 && (
                        <View style={styles.discountBadge}>
                          <ThemedText style={styles.discountText}>-{product.discount}%</ThemedText>
                        </View>
                      )}
                      {product.images && product.images.length > 1 && (
                        <View style={styles.imageCountBadge}>
                          <Ionicons name="images" size={12} color="#fff" />
                          <ThemedText style={styles.imageCountText}>{product.images.length}</ThemedText>
                        </View>
                      )}
                      {product.inStock === false && (
                        <View style={styles.outOfStockOverlay}>
                          <ThemedText style={styles.outOfStockText}>Out of Stock</ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.wholesaleInfo}>
                      <ThemedText style={[styles.wholesaleName, { color: theme.text }]} numberOfLines={2}>
                        {product.label || product.name}
                      </ThemedText>
                      {product.description && (
                        <ThemedText style={[styles.wholesaleDescription, { color: theme.secondary }]} numberOfLines={1}>
                          {product.description}
                        </ThemedText>
                      )}
                      <View style={styles.wholesalePriceRow}>
                        <ThemedText style={[styles.wholesalePrice, { color: theme.primary }]}>
                          Rs. {product.price}
                        </ThemedText>
                        {product.originalPrice && (
                          <ThemedText style={[styles.wholesaleOriginalPrice, { color: theme.secondary }]}>
                            Rs. {product.originalPrice}
                          </ThemedText>
                        )}
                      </View>
                      {product.phoneNumber && (
                        <View style={styles.wholesalePhoneRow}>
                          <Ionicons name="call" size={14} color={theme.primary} />
                          <ThemedText style={[styles.wholesalePhone, { color: theme.primary }]} numberOfLines={1}>
                            {product.phoneNumber}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                {filteredProducts.filter(p => p.category === 'Wholesale' || !selectedCategory).length === 0 && (
                  // Placeholder cards
                  [1, 2].map((i) => (
                    <View key={i} style={styles.widePlaceholderCard}>
                      <View style={styles.widePlaceholderImage} />
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Furnitures Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  Furnitures
                </ThemedText>
                <TouchableOpacity onPress={() => router.push('/market-furniture')}>
                  <ThemedText style={[styles.viewAllText, { color: theme.text }]}>
                    View All
                  </ThemedText>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {filteredProducts.filter(p => p.category === 'Furniture' || p.category === 'Furnitures').slice(0, 4).map((product) => (
                  <TouchableOpacity
                    key={product._id}
                    style={[styles.furnitureCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => router.push({
                      pathname: '/market-product',
                      params: { productId: product._id },
                    })}
                  >
                    <View style={[styles.imageContainer, { height: 140 }]}>
                      {product.images && product.images.length > 0 ? (
                        <Image
                          source={{ uri: product.images[0] }}
                          style={styles.furnitureImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.furnitureImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0E0E0' }]}>
                          <Ionicons name="image-outline" size={32} color="#999" />
                        </View>
                      )}
                      {product.discount && product.discount > 0 && (
                        <View style={styles.discountBadge}>
                          <ThemedText style={styles.discountText}>-{product.discount}%</ThemedText>
                        </View>
                      )}
                      {product.images && product.images.length > 1 && (
                        <View style={styles.imageCountBadge}>
                          <Ionicons name="images" size={12} color="#fff" />
                          <ThemedText style={styles.imageCountText}>{product.images.length}</ThemedText>
                        </View>
                      )}
                      {product.inStock === false && (
                        <View style={styles.outOfStockOverlay}>
                          <ThemedText style={styles.outOfStockText}>Out of Stock</ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.furnitureInfo}>
                      <ThemedText style={[styles.furnitureName, { color: theme.text }]} numberOfLines={2}>
                        {product.label || product.name}
                      </ThemedText>
                      <View style={styles.furniturePriceRow}>
                        <ThemedText style={[styles.furniturePrice, { color: theme.primary }]}>
                          Rs. {product.price}
                        </ThemedText>
                        {product.originalPrice && (
                          <ThemedText style={[styles.furnitureOriginalPrice, { color: theme.secondary }]}>
                            Rs. {product.originalPrice}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                {filteredProducts.filter(p => p.category === 'Furniture' || p.category === 'Furnitures').length === 0 && (
                  // Placeholder cards
                  [1, 2].map((i) => (
                    <View key={i} style={styles.widePlaceholderCard}>
                      <View style={styles.widePlaceholderImage} />
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Hardware Section - Under Furnitures */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  Hardware Items
                </ThemedText>
                <TouchableOpacity onPress={() => router.push('/market-hardware')}>
                  <ThemedText style={[styles.viewAllText, { color: theme.text }]}>
                    View All
                  </ThemedText>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {filteredProducts.filter(p => p.category === 'Hardware').slice(0, 4).map((product) => (
                  <TouchableOpacity
                    key={product._id}
                    style={[styles.furnitureCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => router.push({
                      pathname: '/market-product',
                      params: { productId: product._id },
                    })}
                  >
                    <View style={[styles.imageContainer, { height: 140 }]}>
                      {product.images && product.images.length > 0 ? (
                        <Image
                          source={{ uri: product.images[0] }}
                          style={styles.furnitureImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.furnitureImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0E0E0' }]}>
                          <Ionicons name="image-outline" size={32} color="#999" />
                        </View>
                      )}
                      {product.discount && product.discount > 0 && (
                        <View style={styles.discountBadge}>
                          <ThemedText style={styles.discountText}>-{product.discount}%</ThemedText>
                        </View>
                      )}
                      {product.images && product.images.length > 1 && (
                        <View style={styles.imageCountBadge}>
                          <Ionicons name="images" size={12} color="#fff" />
                          <ThemedText style={styles.imageCountText}>{product.images.length}</ThemedText>
                        </View>
                      )}
                      {product.inStock === false && (
                        <View style={styles.outOfStockOverlay}>
                          <ThemedText style={styles.outOfStockText}>Out of Stock</ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.furnitureInfo}>
                      <ThemedText style={[styles.furnitureName, { color: theme.text }]} numberOfLines={2}>
                        {product.label || product.name}
                      </ThemedText>
                      <View style={styles.furniturePriceRow}>
                        <ThemedText style={[styles.furniturePrice, { color: theme.primary }]}>
                          Rs. {product.price}
                        </ThemedText>
                        {product.originalPrice && (
                          <ThemedText style={[styles.furnitureOriginalPrice, { color: theme.secondary }]}>
                            Rs. {product.originalPrice}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                {filteredProducts.filter(p => p.category === 'Hardware').length === 0 && (
                  [1, 2].map((i) => (
                    <View key={i} style={styles.widePlaceholderCard}>
                      <View style={styles.widePlaceholderImage} />
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Farm Suppliers Section - Under Furnitures */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  Farm Suppliers
                </ThemedText>
                <TouchableOpacity onPress={() => router.push('/market-farm')}>
                  <ThemedText style={[styles.viewAllText, { color: theme.text }]}>
                    View All
                  </ThemedText>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {filteredProducts.filter(p => p.category === 'Farm').slice(0, 4).map((product) => (
                  <TouchableOpacity
                    key={product._id}
                    style={[styles.furnitureCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => router.push({
                      pathname: '/market-product',
                      params: { productId: product._id },
                    })}
                  >
                    <View style={[styles.imageContainer, { height: 140 }]}>
                      {product.images && product.images.length > 0 ? (
                        <Image
                          source={{ uri: product.images[0] }}
                          style={styles.furnitureImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.furnitureImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0E0E0' }]}>
                          <Ionicons name="image-outline" size={32} color="#999" />
                        </View>
                      )}
                      {product.discount && product.discount > 0 && (
                        <View style={styles.discountBadge}>
                          <ThemedText style={styles.discountText}>-{product.discount}%</ThemedText>
                        </View>
                      )}
                      {product.images && product.images.length > 1 && (
                        <View style={styles.imageCountBadge}>
                          <Ionicons name="images" size={12} color="#fff" />
                          <ThemedText style={styles.imageCountText}>{product.images.length}</ThemedText>
                        </View>
                      )}
                      {product.inStock === false && (
                        <View style={styles.outOfStockOverlay}>
                          <ThemedText style={styles.outOfStockText}>Out of Stock</ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.furnitureInfo}>
                      <ThemedText style={[styles.furnitureName, { color: theme.text }]} numberOfLines={2}>
                        {product.label || product.name}
                      </ThemedText>
                      <View style={styles.furniturePriceRow}>
                        <ThemedText style={[styles.furniturePrice, { color: theme.primary }]}>
                          Rs. {product.price}
                        </ThemedText>
                        {product.originalPrice && (
                          <ThemedText style={[styles.furnitureOriginalPrice, { color: theme.secondary }]}>
                            Rs. {product.originalPrice}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                {filteredProducts.filter(p => p.category === 'Farm').length === 0 && (
                  [1, 2].map((i) => (
                    <View key={i} style={styles.widePlaceholderCard}>
                      <View style={styles.widePlaceholderImage} />
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Bottom spacing */}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    borderWidth: 1.5,
    paddingHorizontal: 4,
    paddingVertical: 0,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cartIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchIconContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
    height: '100%',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  horizontalScroll: {
    gap: 12,
  },
  placeholderCard: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  widePlaceholderCard: {
    width: 200,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  widePlaceholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  wholesaleCard: {
    width: 200,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
    overflow: 'hidden',
  },
  wholesaleImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  discountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  imageCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  outOfStockOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  wholesaleInfo: {
    padding: 12,
  },
  wholesaleName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    minHeight: 40,
  },
  wholesaleDescription: {
    fontSize: 12,
    marginBottom: 6,
  },
  wholesalePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  wholesalePrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  wholesaleOriginalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  wholesalePhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  wholesalePhone: {
    fontSize: 12,
    fontWeight: '500',
  },
  furnitureCard: {
    width: 200,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  furnitureImage: {
    width: '100%',
    height: '100%',
  },
  furnitureInfo: {
    padding: 12,
  },
  furnitureName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    minHeight: 36,
  },
  furniturePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  furniturePrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  furnitureOriginalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
});
