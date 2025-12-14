import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface PlanConfig {
    id: string;
    name: string;
    price: number;
    monthlyCredits: number;
    features: string[];
    isActive: boolean;
    displayOrder: number;
    updatedAt?: Date;
    updatedBy?: string;
}

export interface CreditPackage {
    id: string;
    credits: number;
    price: number;
    bonusCredits: number;
    discount: number;
    isPopular: boolean;
    displayOrder: number;
    isActive: boolean;
}

export interface PromoCode {
    id: string;
    code: string;
    type: 'percentage' | 'fixed';
    discountValue: number;
    usageLimit: number;
    usageCount: number;
    expiryDate: Date;
    isActive: boolean;
    applicableTo: 'subscription' | 'credits' | 'both';
    createdAt: Date;
    createdBy: string;
    description?: string;
}

export interface PricingConfig {
    plans: Record<string, PlanConfig>;
    creditPackages: CreditPackage[];
    conversionRate: number; // 1 Credit = X IDR
}

// ============================================
// SUBSCRIPTION PLANS
// ============================================

/**
 * Get all subscription plans configuration
 */
export const getPlansConfig = async (): Promise<Record<string, PlanConfig>> => {
    try {
        const docRef = doc(db, 'pricingConfig', 'plans');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as Record<string, PlanConfig>;
        }

        // Return default plans if not exists
        const defaultPlans = {
            freemium: {
                id: 'freemium',
                name: 'Freemium',
                price: 0,
                monthlyCredits: 0,
                features: [
                    'Akses dasar assessment',
                    'Maksimal 10 kandidat',
                    'Email support',
                    'Data retention 30 hari'
                ],
                isActive: true,
                displayOrder: 1
            },
            premium: {
                id: 'premium',
                name: 'Premium',
                price: 99000,
                monthlyCredits: 100,
                features: [
                    'Unlimited kandidat',
                    'AI Interview lengkap',
                    'KYC Verification',
                    'Priority support',
                    'Data retention unlimited',
                    'Custom branding'
                ],
                isActive: true,
                displayOrder: 2
            }
        };

        // Initialize with defaults
        await setDoc(docRef, defaultPlans);
        return defaultPlans;
    } catch (error) {
        console.error('[PRICING] Error getting plans config:', error);
        throw error;
    }
};

/**
 * Update a specific plan configuration
 */
export const updatePlanConfig = async (
    planId: string,
    updates: Partial<PlanConfig>,
    updatedBy: string
): Promise<void> => {
    try {
        const docRef = doc(db, 'pricingConfig', 'plans');
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Plans configuration not found');
        }

        const plans = docSnap.data();

        if (!plans[planId]) {
            throw new Error(`Plan ${planId} not found`);
        }

        // Update the specific plan
        plans[planId] = {
            ...plans[planId],
            ...updates,
            updatedAt: new Date(),
            updatedBy
        };

        await setDoc(docRef, plans);
        console.log(`[PRICING] Plan ${planId} updated successfully`);
    } catch (error) {
        console.error('[PRICING] Error updating plan:', error);
        throw error;
    }
};

// ============================================
// CREDIT PACKAGES
// ============================================

/**
 * Get credit packages configuration
 */
export const getCreditPackages = async (): Promise<{ packages: CreditPackage[]; conversionRate: number }> => {
    try {
        const docRef = doc(db, 'pricingConfig', 'creditPackages');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as { packages: CreditPackage[]; conversionRate: number };
        }

        // Return default packages if not exists
        const defaultConfig = {
            conversionRate: 1000, // 1 Credit = Rp 1,000
            packages: [
                {
                    id: 'pkg_100',
                    credits: 100,
                    price: 100000,
                    bonusCredits: 0,
                    discount: 0,
                    isPopular: false,
                    displayOrder: 1,
                    isActive: true
                },
                {
                    id: 'pkg_500',
                    credits: 500,
                    price: 475000,
                    bonusCredits: 25,
                    discount: 5,
                    isPopular: true,
                    displayOrder: 2,
                    isActive: true
                },
                {
                    id: 'pkg_1000',
                    credits: 1000,
                    price: 900000,
                    bonusCredits: 100,
                    discount: 10,
                    isPopular: false,
                    displayOrder: 3,
                    isActive: true
                }
            ]
        };

        await setDoc(docRef, defaultConfig);
        return defaultConfig;
    } catch (error) {
        console.error('[PRICING] Error getting credit packages:', error);
        throw error;
    }
};

/**
 * Update credit conversion rate
 */
export const updateConversionRate = async (newRate: number): Promise<void> => {
    try {
        const docRef = doc(db, 'pricingConfig', 'creditPackages');
        await updateDoc(docRef, { conversionRate: newRate });
        console.log(`[PRICING] Conversion rate updated to ${newRate}`);
    } catch (error) {
        console.error('[PRICING] Error updating conversion rate:', error);
        throw error;
    }
};

/**
 * Add new credit package
 */
export const addCreditPackage = async (packageData: Omit<CreditPackage, 'id'>): Promise<string> => {
    try {
        const docRef = doc(db, 'pricingConfig', 'creditPackages');
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Credit packages configuration not found');
        }

        const config = docSnap.data();
        const newPackage = {
            ...packageData,
            id: `pkg_${Date.now()}`
        };

        config.packages.push(newPackage);
        await setDoc(docRef, config);

        console.log(`[PRICING] Package ${newPackage.id} added successfully`);
        return newPackage.id;
    } catch (error) {
        console.error('[PRICING] Error adding package:', error);
        throw error;
    }
};

/**
 * Update credit package
 */
export const updateCreditPackage = async (packageId: string, updates: Partial<CreditPackage>): Promise<void> => {
    try {
        const docRef = doc(db, 'pricingConfig', 'creditPackages');
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Credit packages configuration not found');
        }

        const config = docSnap.data();
        const packageIndex = config.packages.findIndex((pkg: CreditPackage) => pkg.id === packageId);

        if (packageIndex === -1) {
            throw new Error(`Package ${packageId} not found`);
        }

        config.packages[packageIndex] = {
            ...config.packages[packageIndex],
            ...updates
        };

        await setDoc(docRef, config);
        console.log(`[PRICING] Package ${packageId} updated successfully`);
    } catch (error) {
        console.error('[PRICING] Error updating package:', error);
        throw error;
    }
};

/**
 * Delete credit package
 */
export const deleteCreditPackage = async (packageId: string): Promise<void> => {
    try {
        const docRef = doc(db, 'pricingConfig', 'creditPackages');
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Credit packages configuration not found');
        }

        const config = docSnap.data();
        config.packages = config.packages.filter((pkg: CreditPackage) => pkg.id !== packageId);

        await setDoc(docRef, config);
        console.log(`[PRICING] Package ${packageId} deleted successfully`);
    } catch (error) {
        console.error('[PRICING] Error deleting package:', error);
        throw error;
    }
};

// ============================================
// PROMO CODES
// ============================================

/**
 * Get all promo codes
 */
export const getPromoCodes = async (): Promise<PromoCode[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, 'promoCodes'));
        const codes: PromoCode[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            codes.push({
                id: doc.id,
                ...data,
                expiryDate: data.expiryDate?.toDate(),
                createdAt: data.createdAt?.toDate()
            } as PromoCode);
        });

        return codes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
        console.error('[PRICING] Error getting promo codes:', error);
        throw error;
    }
};

/**
 * Create new promo code
 */
export const createPromoCode = async (codeData: Omit<PromoCode, 'id' | 'usageCount' | 'createdAt'>): Promise<string> => {
    try {
        // Check if code already exists
        const existingQuery = query(
            collection(db, 'promoCodes'),
            where('code', '==', codeData.code.toUpperCase())
        );
        const existingDocs = await getDocs(existingQuery);

        if (!existingDocs.empty) {
            throw new Error('Promo code already exists');
        }

        const newCode = {
            ...codeData,
            code: codeData.code.toUpperCase(),
            usageCount: 0,
            createdAt: Timestamp.now(),
            expiryDate: Timestamp.fromDate(codeData.expiryDate)
        };

        const docRef = await addDoc(collection(db, 'promoCodes'), newCode);
        console.log(`[PRICING] Promo code ${codeData.code} created successfully`);
        return docRef.id;
    } catch (error) {
        console.error('[PRICING] Error creating promo code:', error);
        throw error;
    }
};

/**
 * Validate and get promo code
 */
export const validatePromoCode = async (code: string): Promise<PromoCode | null> => {
    try {
        const q = query(
            collection(db, 'promoCodes'),
            where('code', '==', code.toUpperCase()),
            where('isActive', '==', true)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return null;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();
        const promoCode: PromoCode = {
            id: doc.id,
            ...data,
            expiryDate: data.expiryDate?.toDate(),
            createdAt: data.createdAt?.toDate()
        } as PromoCode;

        // Check if expired
        if (promoCode.expiryDate < new Date()) {
            return null;
        }

        // Check if usage limit reached
        if (promoCode.usageCount >= promoCode.usageLimit) {
            return null;
        }

        return promoCode;
    } catch (error) {
        console.error('[PRICING] Error validating promo code:', error);
        return null;
    }
};

/**
 * Increment promo code usage
 */
export const incrementPromoUsage = async (codeId: string): Promise<void> => {
    try {
        const docRef = doc(db, 'promoCodes', codeId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Promo code not found');
        }

        const currentCount = docSnap.data().usageCount || 0;
        await updateDoc(docRef, { usageCount: currentCount + 1 });

        console.log(`[PRICING] Promo code ${codeId} usage incremented`);
    } catch (error) {
        console.error('[PRICING] Error incrementing promo usage:', error);
        throw error;
    }
};

/**
 * Deactivate promo code
 */
export const deactivatePromoCode = async (codeId: string): Promise<void> => {
    try {
        const docRef = doc(db, 'promoCodes', codeId);
        await updateDoc(docRef, { isActive: false });
        console.log(`[PRICING] Promo code ${codeId} deactivated`);
    } catch (error) {
        console.error('[PRICING] Error deactivating promo code:', error);
        throw error;
    }
};

/**
 * Update promo code
 */
export const updatePromoCode = async (codeId: string, updates: Partial<PromoCode>): Promise<void> => {
    try {
        const docRef = doc(db, 'promoCodes', codeId);

        const updateData: any = { ...updates };
        if (updates.expiryDate) {
            updateData.expiryDate = Timestamp.fromDate(updates.expiryDate);
        }

        await updateDoc(docRef, updateData);
        console.log(`[PRICING] Promo code ${codeId} updated successfully`);
    } catch (error) {
        console.error('[PRICING] Error updating promo code:', error);
        throw error;
    }
};

/**
 * Delete promo code
 */
export const deletePromoCode = async (codeId: string): Promise<void> => {
    try {
        const docRef = doc(db, 'promoCodes', codeId);
        await deleteDoc(docRef);
        console.log(`[PRICING] Promo code ${codeId} deleted successfully`);
    } catch (error) {
        console.error('[PRICING] Error deleting promo code:', error);
        throw error;
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate discounted price
 */
export const calculateDiscount = (originalPrice: number, promoCode: PromoCode): number => {
    if (promoCode.type === 'percentage') {
        return originalPrice * (promoCode.discountValue / 100);
    } else {
        return Math.min(promoCode.discountValue, originalPrice);
    }
};

/**
 * Get final price after discount
 */
export const getFinalPrice = (originalPrice: number, promoCode: PromoCode | null): number => {
    if (!promoCode) return originalPrice;
    const discount = calculateDiscount(originalPrice, promoCode);
    return Math.max(0, originalPrice - discount);
};
