import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  _id: string;
  name: string;
  label?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  images: string[];
  category: string;
  description?: string;
  deliveryLocation?: string;
  phoneNumber?: string;
  quantity: number;
  selectedDeliveryAddress?: string;
}

export type PaymentMethod = 'online' | 'cod';
export type WalletProvider = 'phonepay' | 'esewa' | 'stripe';

interface CartContextType {
  items: CartItem[];
  paymentMethod: PaymentMethod | null;
  walletProvider: WalletProvider | null;
  rewardPointsUsed: number;
  deliveryCharge: number;
  addToCart: (product: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
  updateDeliveryAddress: (productId: string, address: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setWalletProvider: (provider: WalletProvider) => void;
  setRewardPointsUsed: (points: number) => void;
  getDeliveryCharge: () => number;
  getSubtotal: () => number;
  getRewardPointsDiscount: (pointsUsed: number) => number;
  getFinalTotal: (rewardPointsUsed: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [walletProvider, setWalletProvider] = useState<WalletProvider | null>(null);
  const [rewardPointsUsed, setRewardPointsUsed] = useState<number>(0);
  const DELIVERY_CHARGE = 50; // Base delivery charge in NPR
  const COD_EXTRA_CHARGE = 20; // Extra charge for Cash on Delivery

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    saveCart();
  }, [items]);

  const loadCart = async () => {
    try {
      const storedCart = await AsyncStorage.getItem('cart');
      if (storedCart) {
        setItems(JSON.parse(storedCart));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const saveCart = async () => {
    try {
      await AsyncStorage.setItem('cart', JSON.stringify(items));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const addToCart = (product: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item._id === product._id);
      if (existingItem) {
        return prevItems.map((item) =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevItems, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item._id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((item) =>
        item._id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const updateDeliveryAddress = (productId: string, address: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item._id === productId ? { ...item, selectedDeliveryAddress: address } : item
      )
    );
  };

  const getDeliveryCharge = (): number => {
    return DELIVERY_CHARGE;
  };

  const getSubtotal = (): number => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getRewardPointsDiscount = (pointsUsed: number): number => {
    // 100 points = 1 NPR discount
    // Max discount: 50% of subtotal
    const maxDiscount = getSubtotal() * 0.5;
    const discount = Math.min(pointsUsed / 100, maxDiscount);
    return discount;
  };

  const getFinalTotal = (rewardPointsUsed: number = rewardPointsUsed): number => {
    const subtotal = getSubtotal();
    const delivery = getDeliveryCharge();
    const codExtra = paymentMethod === 'cod' ? COD_EXTRA_CHARGE : 0;
    const discount = getRewardPointsDiscount(rewardPointsUsed);
    
    return Math.max(0, subtotal + delivery + codExtra - discount);
  };

  const value: CartContextType = {
    items,
    paymentMethod,
    walletProvider,
    rewardPointsUsed,
    deliveryCharge: DELIVERY_CHARGE,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getTotalItems,
    updateDeliveryAddress,
    setPaymentMethod,
    setWalletProvider,
    setRewardPointsUsed,
    getDeliveryCharge,
    getSubtotal,
    getRewardPointsDiscount,
    getFinalTotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
