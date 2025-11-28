import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  priceType: 'hour' | 'per_foot' | 'fixed' | 'customize';
  description: string;
}

interface ServiceRegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  onAddService: (service: Service | Service[]) => void; // Accept single or array
  existingServices: Service[];
  editingService?: Service | null;
}

const serviceCategories = [
  'Plumber', 'Electrician', 'Carpenter', 'Cleaner', 'Mechanic', 
  'AC Repair', 'Painter', 'Mason', 'Cook', 'Driver', 'Security', 
  'Beautician', 'Technician', 'Delivery', 'Gardener'
];

const priceTypes = [
  { value: 'hour', label: 'Per Hour' },
  { value: 'per_foot', label: 'Per Foot' },
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'customize', label: 'Customize' }
];

export default function ServiceRegistrationModal({
  visible,
  onClose,
  onAddService,
  existingServices,
  editingService,
}: ServiceRegistrationModalProps) {
  const [formData, setFormData] = useState<{
    name: string;
    category: string;
    selectedCategories: string[]; // For multi-select
    price: string;
    priceType: 'hour' | 'per_foot' | 'fixed' | 'customize';
    description: string;
  }>({
    name: '',
    category: '',
    selectedCategories: [],
    price: '',
    priceType: 'hour',
    description: '',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isMultiSelect, setIsMultiSelect] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editingService) {
        setFormData({
          name: editingService.name,
          category: editingService.category,
          selectedCategories: [],
          price: editingService.price.toString(),
          priceType: editingService.priceType,
          description: editingService.description,
        });
        setIsMultiSelect(false);
      } else {
        setFormData({
          name: '',
          category: '',
          selectedCategories: [],
          price: '',
          priceType: 'hour',
          description: '',
        });
        setIsMultiSelect(true); // Default to multi-select for new services
      }
      setErrors({});
    }
  }, [visible, editingService]);

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (isMultiSelect && !editingService) {
      // For multi-select, only check if at least one category is selected
      if (formData.selectedCategories.length === 0) {
        newErrors.category = 'Please select at least one service category';
      }
    } else {
      // For single select or editing - show all fields
      if (!formData.name.trim()) {
        newErrors.name = 'Service name is required';
      }

      if (!formData.category) {
        newErrors.category = 'Category is required';
      }

      if (!formData.price || parseFloat(formData.price) <= 0) {
        newErrors.price = 'Valid price is required';
      }

      if (!formData.description.trim()) {
        newErrors.description = 'Description is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    if (isMultiSelect && !editingService && formData.selectedCategories.length > 0) {
      // Create multiple services for selected categories with default values
      const existingCategories = existingServices.map(s => s.category);
      const servicesToAdd = formData.selectedCategories
        .filter(cat => !existingCategories.includes(cat)) // Don't add duplicates
        .map((category, index) => ({
          id: `service-${category}-${Date.now()}-${index}`,
          name: `${category} Service`,
          category: category,
          price: 0, // Default price - can be updated later
          priceType: 'hour' as const, // Default price type
          description: `Professional ${category} services`, // Default description
        }));

      if (servicesToAdd.length > 0) {
        onAddService(servicesToAdd); // Pass array for multi-add
        onClose();
      } else {
        Alert.alert('Info', 'All selected categories already exist in your services.');
      }
    } else {
      // Single service add/edit
      const service: Service = {
        id: editingService ? editingService.id : Date.now().toString(),
        name: formData.name.trim(),
        category: formData.category,
        price: parseFloat(formData.price),
        priceType: formData.priceType,
        description: formData.description.trim(),
      };

      onAddService(service);
      onClose();
    }
  };

  const toggleCategorySelection = (category: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedCategories.includes(category);
      return {
        ...prev,
        selectedCategories: isSelected
          ? prev.selectedCategories.filter(c => c !== category)
          : [...prev.selectedCategories, category],
      };
    });
    if (errors.category) {
      setErrors(prev => ({ ...prev, category: '' }));
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editingService ? 'Edit Service' : 'Add Service'}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Category - Multi-select or Single select */}
          <View style={styles.inputGroup}>
            <View style={styles.categoryHeader}>
              <Text style={styles.label}>Category</Text>
              {!editingService && (
                <Text style={styles.selectMultipleHint}>Select multiple</Text>
              )}
            </View>
            
            {isMultiSelect && !editingService ? (
              // Multi-select mode - only show categories that are NOT already registered
              // Display as a grid instead of horizontal scroll
              <View style={styles.categoryGrid}>
                {serviceCategories
                  .filter(category => {
                    // Exclude already registered services
                    return !existingServices.some(s => s.category === category);
                  })
                  .map((category) => {
                    const isSelected = formData.selectedCategories.includes(category);
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryChipGrid,
                          isSelected && styles.selectedCategoryChipGrid
                        ]}
                        onPress={() => toggleCategorySelection(category)}
                      >
                        <Text style={[
                          styles.categoryChipTextGrid,
                          isSelected && styles.selectedCategoryChipTextGrid
                        ]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            ) : (
              // Single select mode
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {serviceCategories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      formData.category === category && styles.selectedCategoryChip
                    ]}
                    onPress={() => handleInputChange('category', category)}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      formData.category === category && styles.selectedCategoryChipText
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
          </View>

          {/* Only show other fields when editing or in single-select mode */}
          {(!isMultiSelect || editingService) && (
            <>
              {/* Service Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Service Name *</Text>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  value={formData.name}
                  onChangeText={(value) => handleInputChange('name', value)}
                  placeholder="e.g., Furniture Repair"
                />
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>

              {/* Price and Price Type */}
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Price (Rs.) *</Text>
                  <TextInput
                    style={[styles.input, errors.price && styles.inputError]}
                    value={formData.price}
                    onChangeText={(value) => handleInputChange('price', value)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Price Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.priceTypeScroll}>
                    {priceTypes.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.priceTypeChip,
                          formData.priceType === type.value && styles.selectedPriceTypeChip
                        ]}
                        onPress={() => handleInputChange('priceType', type.value)}
                      >
                        <Text style={[
                          styles.priceTypeChipText,
                          formData.priceType === type.value && styles.selectedPriceTypeChipText
                        ]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description *</Text>
                <TextInput
                  style={[styles.textArea, errors.description && styles.inputError]}
                  value={formData.description}
                  onChangeText={(value) => handleInputChange('description', value)}
                  placeholder="Describe your service..."
                  multiline
                  numberOfLines={4}
                />
                {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
              </View>
            </>
          )}

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>
              {editingService 
                ? 'Update Service' 
                : isMultiSelect 
                  ? `Add ${formData.selectedCategories.length || ''} Service${formData.selectedCategories.length > 1 ? 's' : ''}`
                  : 'Add Service'
              }
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  modeToggleText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  disabledCategoryChip: {
    backgroundColor: '#E5E7EB',
    borderColor: '#D1D5DB',
    opacity: 0.6,
  },
  disabledCategoryChipText: {
    color: '#9CA3AF',
  },
  selectedCount: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '600',
  },
  excludedInfo: {
    marginLeft: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignSelf: 'center',
  },
  excludedInfoText: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipGrid: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: '30%',
    flex: 1,
    maxWidth: '48%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCategoryChip: {
    backgroundColor: '#FF7A2C',
    borderColor: '#FF7A2C',
  },
  selectedCategoryChipGrid: {
    backgroundColor: '#FF7A2C',
    borderColor: '#FF7A2C',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryChipTextGrid: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedCategoryChipText: {
    color: '#fff',
  },
  selectedCategoryChipTextGrid: {
    color: '#fff',
    fontWeight: '600',
  },
  selectMultipleHint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  priceTypeScroll: {
    marginBottom: 8,
  },
  priceTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedPriceTypeChip: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  priceTypeChipText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  selectedPriceTypeChipText: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#FF7A2C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
