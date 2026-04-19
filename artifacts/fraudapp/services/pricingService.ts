import { supabase } from './supabase';

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
    conversionRate: number;
}

// ==========================================
// CONFIG TABLE HELPERS
// ==========================================

const getConfig = async (configId: string) => {
    const { data } = await supabase.from('pricing_config').select('data').eq('id', configId).single();
    return data?.data || null;
};

const upsertConfig = async (configId: string, value: any) => {
    const { error } = await supabase.from('pricing_config').upsert({ id: configId, data: value, updatedAt: new Date().toISOString() });
    if (error) throw error;
};

// ==========================================
// SUBSCRIPTION PLANS
// ==========================================

export const getPlansConfig = async (): Promise<Record<string, PlanConfig>> => {
    const data = await getConfig('plans');
    if (data) return data;

    const defaultPlans = {
        freemium: { id: 'freemium', name: 'Freemium', price: 0, monthlyCredits: 0, features: ['Akses dasar assessment', 'Maksimal 10 kandidat', 'Email support', 'Data retention 30 hari'], isActive: true, displayOrder: 1 },
        premium: { id: 'premium', name: 'Premium', price: 99000, monthlyCredits: 100, features: ['Unlimited kandidat', 'AI Interview lengkap', 'KYC Verification', 'Priority support', 'Data retention unlimited', 'Custom branding'], isActive: true, displayOrder: 2 }
    };
    await upsertConfig('plans', defaultPlans);
    return defaultPlans;
};

export const updatePlanConfig = async (planId: string, updates: Partial<PlanConfig>, updatedBy: string): Promise<void> => {
    const plans = await getPlansConfig();
    if (!plans[planId]) throw new Error(`Plan ${planId} not found`);
    plans[planId] = { ...plans[planId], ...updates, updatedAt: new Date(), updatedBy };
    await upsertConfig('plans', plans);
};

// ==========================================
// CREDIT PACKAGES
// ==========================================

export const getCreditPackages = async (): Promise<{ packages: CreditPackage[]; conversionRate: number }> => {
    const data = await getConfig('creditPackages');
    if (data) return data;

    const defaultConfig = {
        conversionRate: 1000,
        packages: [
            { id: 'pkg_100', credits: 100, price: 100000, bonusCredits: 0, discount: 0, isPopular: false, displayOrder: 1, isActive: true },
            { id: 'pkg_500', credits: 500, price: 475000, bonusCredits: 25, discount: 5, isPopular: true, displayOrder: 2, isActive: true },
            { id: 'pkg_1000', credits: 1000, price: 900000, bonusCredits: 100, discount: 10, isPopular: false, displayOrder: 3, isActive: true }
        ]
    };
    await upsertConfig('creditPackages', defaultConfig);
    return defaultConfig;
};

export const updateConversionRate = async (newRate: number): Promise<void> => {
    const config = await getCreditPackages();
    await upsertConfig('creditPackages', { ...config, conversionRate: newRate });
};

export const addCreditPackage = async (packageData: Omit<CreditPackage, 'id'>): Promise<string> => {
    const config = await getCreditPackages();
    const newPackage = { ...packageData, id: `pkg_${Date.now()}` };
    config.packages.push(newPackage);
    await upsertConfig('creditPackages', config);
    return newPackage.id;
};

export const updateCreditPackage = async (packageId: string, updates: Partial<CreditPackage>): Promise<void> => {
    const config = await getCreditPackages();
    const idx = config.packages.findIndex(p => p.id === packageId);
    if (idx === -1) throw new Error(`Package ${packageId} not found`);
    config.packages[idx] = { ...config.packages[idx], ...updates };
    await upsertConfig('creditPackages', config);
};

export const deleteCreditPackage = async (packageId: string): Promise<void> => {
    const config = await getCreditPackages();
    config.packages = config.packages.filter(p => p.id !== packageId);
    await upsertConfig('creditPackages', config);
};

// ==========================================
// PROMO CODES
// ==========================================

export const getPromoCodes = async (): Promise<PromoCode[]> => {
    const { data, error } = await supabase.from('promo_codes').select('*').order('createdAt', { ascending: false });
    if (error) throw error;
    return (data || []).map((d: any) => ({
        ...d,
        expiryDate: new Date(d.expiryDate),
        createdAt: new Date(d.createdAt)
    })) as PromoCode[];
};

export const createPromoCode = async (codeData: Omit<PromoCode, 'id' | 'usageCount' | 'createdAt'>): Promise<string> => {
    const { data: existing } = await supabase.from('promo_codes').select('id').eq('code', codeData.code.toUpperCase()).single();
    if (existing) throw new Error('Promo code already exists');

    const { data, error } = await supabase.from('promo_codes').insert({
        ...codeData,
        code: codeData.code.toUpperCase(),
        usageCount: 0,
        createdAt: new Date().toISOString(),
        expiryDate: codeData.expiryDate instanceof Date ? codeData.expiryDate.toISOString() : codeData.expiryDate
    }).select('id').single();
    if (error) throw error;
    return data.id;
};

export const validatePromoCode = async (code: string): Promise<PromoCode | null> => {
    const { data, error } = await supabase.from('promo_codes').select('*').eq('code', code.toUpperCase()).eq('isActive', true).single();
    if (error || !data) return null;
    const promoCode = { ...data, expiryDate: new Date(data.expiryDate), createdAt: new Date(data.createdAt) } as PromoCode;
    if (promoCode.expiryDate < new Date()) return null;
    if (promoCode.usageCount >= promoCode.usageLimit) return null;
    return promoCode;
};

export const incrementPromoUsage = async (codeId: string): Promise<void> => {
    const { data, error: fetchErr } = await supabase.from('promo_codes').select('usageCount').eq('id', codeId).single();
    if (fetchErr || !data) throw new Error('Promo code not found');
    const { error } = await supabase.from('promo_codes').update({ usageCount: (data.usageCount || 0) + 1 }).eq('id', codeId);
    if (error) throw error;
};

export const deactivatePromoCode = async (codeId: string): Promise<void> => {
    const { error } = await supabase.from('promo_codes').update({ isActive: false }).eq('id', codeId);
    if (error) throw error;
};

export const updatePromoCode = async (codeId: string, updates: Partial<PromoCode>): Promise<void> => {
    const updateData: any = { ...updates };
    if (updates.expiryDate) updateData.expiryDate = updates.expiryDate instanceof Date ? updates.expiryDate.toISOString() : updates.expiryDate;
    const { error } = await supabase.from('promo_codes').update(updateData).eq('id', codeId);
    if (error) throw error;
};

export const deletePromoCode = async (codeId: string): Promise<void> => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', codeId);
    if (error) throw error;
};

// ==========================================
// UTILITY
// ==========================================

export const calculateDiscount = (originalPrice: number, promoCode: PromoCode): number => {
    if (promoCode.type === 'percentage') return originalPrice * (promoCode.discountValue / 100);
    return Math.min(promoCode.discountValue, originalPrice);
};

export const getFinalPrice = (originalPrice: number, promoCode: PromoCode | null): number => {
    if (!promoCode) return originalPrice;
    return Math.max(0, originalPrice - calculateDiscount(originalPrice, promoCode));
};
