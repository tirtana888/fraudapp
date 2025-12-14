import React, { useState, useEffect } from 'react';
import {
    DollarSign,
    Package,
    Tag,
    Edit2,
    Trash2,
    Plus,
    Check,
    X,
    Calendar,
    Percent,
    Coins,
    Crown,
    Sparkles,
    Save,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { useToast } from './Toast';
import {
    getPlansConfig,
    updatePlanConfig,
    PlanConfig,
    getCreditPackages,
    updateConversionRate,
    addCreditPackage,
    updateCreditPackage,
    deleteCreditPackage,
    CreditPackage,
    PromoCode,
    getPromoCodes,
    createPromoCode,
    updatePromoCode,
    deactivatePromoCode,
    deletePromoCode
} from '../services/pricingService';
import { auth } from '../services/firebase';

interface PricingManagerPageProps {
    onBack?: () => void;
}

type TabType = 'plans' | 'credits' | 'promos';

const PricingManagerPage: React.FC<PricingManagerPageProps> = ({ onBack }) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<TabType>('plans');
    const [isLoading, setIsLoading] = useState(false);

    // Tab Navigation Component
    const TabButton = ({ tab, label, icon: Icon }: { tab: TabType; label: string; icon: any }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === tab
                ? 'bg-white text-brand-orange shadow-sm ring-1 ring-gray-200 dark:bg-slate-700 dark:text-white dark:ring-slate-600'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 dark:border-slate-700 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Pricing Manager</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Manage subscription plans, credit pricing, and promo codes</p>
                        </div>
                    </div>

                    {/* Modern Tab Navigation (Segmented Control) */}
                    <div className="inline-flex items-center p-1.5 bg-gray-100 dark:bg-slate-800 rounded-xl">
                        <TabButton tab="plans" label="Subscription Plans" icon={Crown} />
                        <TabButton tab="credits" label="Credit Pricing" icon={Coins} />
                        <TabButton tab="promos" label="Promo Codes" icon={Tag} />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {activeTab === 'plans' && <SubscriptionPlansTab />}
                {activeTab === 'credits' && <CreditPricingTab />}
                {activeTab === 'promos' && <PromoCodesTab />}
            </div>
        </div>
    );
};

// ============================================
// TAB 1: SUBSCRIPTION PLANS
// ============================================

const SubscriptionPlansTab: React.FC = () => {
    const toast = useToast();
    const [plans, setPlans] = useState<Record<string, PlanConfig>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            setIsLoading(true);
            const plansData = await getPlansConfig();
            setPlans(plansData);
        } catch (error) {
            console.error('Error loading plans:', error);
            toast.error('Failed to load plans');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditPlan = (plan: PlanConfig) => {
        setEditingPlan({ ...plan });
        setShowEditModal(true);
    };

    const handleSavePlan = async () => {
        if (!editingPlan || !auth.currentUser) return;

        try {
            setIsSaving(true);
            await updatePlanConfig(
                editingPlan.id,
                {
                    name: editingPlan.name,
                    price: editingPlan.price,
                    monthlyCredits: editingPlan.monthlyCredits,
                    features: editingPlan.features,
                    isActive: editingPlan.isActive
                },
                auth.currentUser.email || 'admin'
            );

            await loadPlans();
            toast.success('Plan updated successfully!');
            setShowEditModal(false);
        } catch (error) {
            console.error('Error saving plan:', error);
            toast.error('Failed to save plan');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={48} className="text-[#D95D00] animate-spin" />
            </div>
        );
    }

    const plansArray = Object.values(plans);

    return (
        <div>
            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plansArray.map((plan) => (
                    <div
                        key={plan.id}
                        className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all duration-300"
                    >
                        {/* Plan Header */}
                        <div className={`p-8 ${plan.id === 'premium'
                            ? 'bg-gradient-to-br from-brand-orange to-orange-600'
                            : 'bg-white dark:bg-brand-slate-850'
                            }`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className={`text-xl font-bold ${plan.id === 'premium' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                        {plan.name}
                                    </h3>
                                    <div className={`mt-3 ${plan.id === 'premium' ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-4xl font-bold ${plan.id === 'premium' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                {plan.price === 0 ? 'Gratis' : `Rp ${plan.price.toLocaleString('id-ID')}`}
                                            </span>
                                            {plan.price > 0 && <span className="text-sm font-medium opacity-80">/mo</span>}
                                        </div>
                                    </div>
                                </div>
                                {plan.id === 'premium' && (
                                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                        <Crown size={24} className="text-white" />
                                    </div>
                                )}
                            </div>

                            {plan.monthlyCredits > 0 && (
                                <div className={`mt-6 flex items-center gap-2 text-sm font-medium ${plan.id === 'premium' ? 'text-white/90 bg-white/10 p-2 rounded-lg' : 'text-brand-orange bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg inline-block'
                                    }`}>
                                    <Coins size={16} />
                                    <span>{plan.monthlyCredits} credits included</span>
                                </div>
                            )}
                        </div>

                        {/* Features */}
                        <div className="p-8 pt-6 border-t border-gray-100 dark:border-slate-700">
                            <ul className="space-y-4">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                                        <div className={`mt-0.5 p-0.5 rounded-full ${plan.id === 'premium' ? 'bg-orange-100 text-brand-orange dark:bg-orange-900/30' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'
                                            }`}>
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                        <span className="leading-relaxed">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* Edit Button */}
                            <button
                                onClick={() => handleEditPlan(plan)}
                                className="mt-8 w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border border-gray-200 dark:border-slate-600 group"
                            >
                                <Edit2 size={16} className="text-gray-400 group-hover:text-gray-600" />
                                Edit Configuration
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {showEditModal && editingPlan && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-[#D95D00] to-[#FF8C00] p-6 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">Edit {editingPlan.name} Plan</h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Plan Name</label>
                                <input
                                    type="text"
                                    value={editingPlan.name}
                                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Price (IDR/month)</label>
                                <input
                                    type="number"
                                    value={editingPlan.price}
                                    onChange={(e) => setEditingPlan({ ...editingPlan, price: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Credits</label>
                                <input
                                    type="number"
                                    value={editingPlan.monthlyCredits}
                                    onChange={(e) => setEditingPlan({ ...editingPlan, monthlyCredits: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
                                <div className="space-y-2">
                                    {editingPlan.features.map((feature: string, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={feature}
                                                onChange={(e) => {
                                                    const newFeatures = [...editingPlan.features];
                                                    newFeatures[idx] = e.target.value;
                                                    setEditingPlan({ ...editingPlan, features: newFeatures });
                                                }}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                                            />
                                            <button
                                                onClick={() => {
                                                    const newFeatures = editingPlan.features.filter((_: any, i: number) => i !== idx);
                                                    setEditingPlan({ ...editingPlan, features: newFeatures });
                                                }}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setEditingPlan({ ...editingPlan, features: [...editingPlan.features, ''] })}
                                        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#D95D00] hover:text-[#D95D00] transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus size={16} />
                                        Add Feature
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-gray-50 flex gap-3">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSavePlan}
                                disabled={isSaving}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// TAB 2: CREDIT PRICING
// ============================================

const CreditPricingTab: React.FC = () => {
    const toast = useToast();
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [conversionRate, setConversionRate] = useState(1000);
    const [isLoading, setIsLoading] = useState(true);
    const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingRate, setEditingRate] = useState(false);
    const [newRate, setNewRate] = useState(1000);

    useEffect(() => {
        loadPackages();
    }, []);

    const loadPackages = async () => {
        try {
            setIsLoading(true);
            const { packages: pkgs, conversionRate: rate } = await getCreditPackages();
            setPackages(pkgs.sort((a, b) => a.displayOrder - b.displayOrder));
            setConversionRate(rate);
            setNewRate(rate);
        } catch (error) {
            console.error('Error loading packages:', error);
            toast.error('Failed to load credit packages');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveRate = async () => {
        try {
            setIsSaving(true);
            await updateConversionRate(newRate);
            setConversionRate(newRate);
            setEditingRate(false);
            toast.success('Conversion rate updated!');
        } catch (error) {
            console.error('Error updating rate:', error);
            toast.error('Failed to update conversion rate');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePackage = async () => {
        if (!editingPackage) return;

        try {
            setIsSaving(true);
            if (editingPackage.id.startsWith('new_')) {
                // Add new package
                await addCreditPackage({
                    credits: editingPackage.credits,
                    price: editingPackage.price,
                    bonusCredits: editingPackage.bonusCredits,
                    discount: editingPackage.discount,
                    isPopular: editingPackage.isPopular,
                    displayOrder: packages.length + 1,
                    isActive: true
                });
            } else {
                // Update existing
                await updateCreditPackage(editingPackage.id, editingPackage);
            }

            await loadPackages();
            toast.success('Package saved successfully!');
            setShowEditModal(false);
            setShowAddModal(false);
        } catch (error) {
            console.error('Error saving package:', error);
            toast.error('Failed to save package');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePackage = async (packageId: string) => {
        if (!confirm('Are you sure you want to delete this package?')) return;

        try {
            await deleteCreditPackage(packageId);
            await loadPackages();
            toast.success('Package deleted successfully!');
        } catch (error) {
            console.error('Error deleting package:', error);
            toast.error('Failed to delete package');
        }
    };

    const formatIDR = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={48} className="text-[#D95D00] animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Conversion Rate Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Credit Conversion Rate</h3>
                        <p className="text-sm text-gray-600 mt-1">Set the base price for 1 credit</p>
                    </div>
                    {!editingRate && (
                        <button
                            onClick={() => setEditingRate(true)}
                            className="px-4 py-2 text-[#D95D00] hover:bg-orange-50 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <Edit2 size={16} />
                            Edit Rate
                        </button>
                    )}
                </div>

                {editingRate ? (
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                1 Credit = Rp
                            </label>
                            <input
                                type="number"
                                value={newRate}
                                onChange={(e) => setNewRate(parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            />
                        </div>
                        <div className="flex gap-2 mt-7">
                            <button
                                onClick={() => {
                                    setEditingRate(false);
                                    setNewRate(conversionRate);
                                }}
                                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveRate}
                                disabled={isSaving}
                                className="px-4 py-2 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-lg p-6">
                        <div className="text-sm opacity-90 mb-1">Current Rate</div>
                        <div className="text-3xl font-black">
                            1 Credit = {formatIDR(conversionRate)}
                        </div>
                    </div>
                )}
            </div>

            {/* Packages Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Credit Packages</h3>
                    <p className="text-sm text-gray-600 mt-1">Manage top-up packages and pricing</p>
                </div>
                <button
                    onClick={() => {
                        setEditingPackage({
                            id: `new_${Date.now()}`,
                            credits: 100,
                            price: 100000,
                            bonusCredits: 0,
                            discount: 0,
                            isPopular: false,
                            displayOrder: packages.length + 1,
                            isActive: true
                        });
                        setShowAddModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
                >
                    <Plus size={18} />
                    Add Package
                </button>
            </div>

            {/* Packages Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Credits
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Price
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Bonus
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Discount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {packages.map((pkg) => (
                            <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                            <Coins size={16} className="text-brand-orange" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-white">{pkg.credits} Credits</div>
                                            {pkg.isPopular && (
                                                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                                                    POPULAR
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                                        {formatIDR(pkg.price)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {pkg.bonusCredits > 0 ? (
                                        <span className="text-green-600 font-medium">+{pkg.bonusCredits}</span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {pkg.discount > 0 ? (
                                        <span className="text-orange-600 font-medium">{pkg.discount}%</span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${pkg.isActive
                                        ? 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                                        : 'bg-gray-50 border-gray-100 text-gray-700 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${pkg.isActive ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                        {pkg.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingPackage({ ...pkg });
                                                setShowEditModal(true);
                                            }}
                                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeletePackage(pkg.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {packages.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <Package size={48} className="mx-auto mb-3 text-gray-300" />
                        <p>No packages yet. Click "Add Package" to create one.</p>
                    </div>
                )}
            </div>

            {/* Edit/Add Package Modal */}
            {(showEditModal || showAddModal) && editingPackage && (
                <PackageModal
                    package={editingPackage}
                    isNew={showAddModal}
                    isSaving={isSaving}
                    onSave={handleSavePackage}
                    onClose={() => {
                        setShowEditModal(false);
                        setShowAddModal(false);
                    }}
                    onChange={setEditingPackage}
                />
            )}
        </div>
    );
};

// ============================================
// PACKAGE MODAL COMPONENT
// ============================================

interface PackageModalProps {
    package: CreditPackage;
    isNew: boolean;
    isSaving: boolean;
    onSave: () => void;
    onClose: () => void;
    onChange: (pkg: CreditPackage) => void;
}

const PackageModal: React.FC<PackageModalProps> = ({
    package: pkg,
    isNew,
    isSaving,
    onSave,
    onClose,
    onChange
}) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#D95D00] to-[#FF8C00] p-6 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">
                        {isNew ? 'Add New Package' : 'Edit Package'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Credits Amount
                            </label>
                            <input
                                type="number"
                                value={pkg.credits}
                                onChange={(e) => onChange({ ...pkg, credits: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Price (IDR)
                            </label>
                            <input
                                type="number"
                                value={pkg.price}
                                onChange={(e) => onChange({ ...pkg, price: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bonus Credits
                            </label>
                            <input
                                type="number"
                                value={pkg.bonusCredits}
                                onChange={(e) => onChange({ ...pkg, bonusCredits: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Discount (%)
                            </label>
                            <input
                                type="number"
                                value={pkg.discount}
                                onChange={(e) => onChange({ ...pkg, discount: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={pkg.isPopular}
                                onChange={(e) => onChange({ ...pkg, isPopular: e.target.checked })}
                                className="w-4 h-4 text-[#D95D00] border-gray-300 rounded focus:ring-[#D95D00]"
                            />
                            <span className="text-sm font-medium text-gray-700">Mark as Popular</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={pkg.isActive}
                                onChange={(e) => onChange({ ...pkg, isActive: e.target.checked })}
                                className="w-4 h-4 text-[#D95D00] border-gray-300 rounded focus:ring-[#D95D00]"
                            />
                            <span className="text-sm font-medium text-gray-700">Active</span>
                        </label>
                    </div>

                    {/* Preview */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-600 mb-2">PREVIEW:</p>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-gray-800">
                                    {pkg.credits + pkg.bonusCredits} Credits
                                    {pkg.bonusCredits > 0 && (
                                        <span className="text-green-600 text-sm ml-1">(+{pkg.bonusCredits} bonus)</span>
                                    )}
                                </p>
                                {pkg.discount > 0 && (
                                    <p className="text-xs text-orange-600 font-medium">{pkg.discount}% discount</p>
                                )}
                            </div>
                            <p className="text-lg font-black text-gray-800">
                                Rp {pkg.price.toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-gray-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                {isNew ? 'Add Package' : 'Save Changes'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// TAB 3: PROMO CODES
// ============================================

const PromoCodesTab: React.FC = () => {
    const toast = useToast();
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadPromoCodes();
    }, []);

    const loadPromoCodes = async () => {
        try {
            setIsLoading(true);
            const codes = await getPromoCodes();
            setPromoCodes(codes);
        } catch (error) {
            console.error('Error loading promo codes:', error);
            toast.error('Failed to load promo codes');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCode = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 30);

        setEditingCode({
            id: `new_${Date.now()}`,
            code: '',
            type: 'percentage',
            discountValue: 10,
            usageLimit: 100,
            usageCount: 0,
            expiryDate: tomorrow,
            isActive: true,
            applicableTo: 'both',
            createdAt: new Date(),
            createdBy: auth.currentUser?.email || 'admin',
            description: ''
        });
        setShowCreateModal(true);
    };

    const handleSaveCode = async () => {
        if (!editingCode || !auth.currentUser) return;

        // Validation
        if (!editingCode.code.trim()) {
            toast.error('Promo code cannot be empty');
            return;
        }

        if (editingCode.discountValue <= 0) {
            toast.error('Discount value must be greater than 0');
            return;
        }

        try {
            setIsSaving(true);

            if (editingCode.id.startsWith('new_')) {
                // Create new code
                await createPromoCode({
                    code: editingCode.code.toUpperCase(),
                    type: editingCode.type,
                    discountValue: editingCode.discountValue,
                    usageLimit: editingCode.usageLimit,
                    expiryDate: editingCode.expiryDate,
                    isActive: editingCode.isActive,
                    applicableTo: editingCode.applicableTo,
                    createdBy: auth.currentUser.email || 'admin',
                    description: editingCode.description
                });
            } else {
                // Update existing code
                await updatePromoCode(editingCode.id, {
                    type: editingCode.type,
                    discountValue: editingCode.discountValue,
                    usageLimit: editingCode.usageLimit,
                    expiryDate: editingCode.expiryDate,
                    isActive: editingCode.isActive,
                    applicableTo: editingCode.applicableTo,
                    description: editingCode.description
                });
            }

            await loadPromoCodes();
            toast.success('Promo code saved successfully!');
            setShowCreateModal(false);
            setShowEditModal(false);
        } catch (error: any) {
            console.error('Error saving promo code:', error);
            toast.error(error.message || 'Failed to save promo code');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (code: PromoCode) => {
        try {
            if (code.isActive) {
                await deactivatePromoCode(code.id);
                toast.success('Promo code deactivated');
            } else {
                await updatePromoCode(code.id, { isActive: true });
                toast.success('Promo code activated');
            }
            await loadPromoCodes();
        } catch (error) {
            console.error('Error toggling promo code:', error);
            toast.error('Failed to update promo code');
        }
    };

    const handleDeleteCode = async (codeId: string) => {
        if (!confirm('Are you sure you want to delete this promo code?')) return;

        try {
            await deletePromoCode(codeId);
            await loadPromoCodes();
            toast.success('Promo code deleted successfully!');
        } catch (error) {
            console.error('Error deleting promo code:', error);
            toast.error('Failed to delete promo code');
        }
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    };

    const isExpired = (date: Date) => {
        return date < new Date();
    };

    const getStatusBadge = (code: PromoCode) => {
        if (!code.isActive) {
            return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">Inactive</span>;
        }
        if (isExpired(code.expiryDate)) {
            return <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-full">Expired</span>;
        }
        if (code.usageCount >= code.usageLimit) {
            return <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-semibold rounded-full">Limit Reached</span>;
        }
        return <span className="px-2 py-1 bg-green-100 text-green-600 text-xs font-semibold rounded-full">Active</span>;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={48} className="text-[#D95D00] animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Promo Codes</h3>
                    <p className="text-sm text-gray-600 mt-1">Create and manage discount codes</p>
                </div>
                <button
                    onClick={handleCreateCode}
                    className="px-4 py-2 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
                >
                    <Plus size={18} />
                    Create Promo Code
                </button>
            </div>

            {/* Promo Codes Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Code
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Discount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Usage
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Expiry
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {promoCodes.map((code) => (
                            <tr key={code.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Tag size={16} className="text-[#D95D00]" />
                                            <span className="font-bold text-gray-800">{code.code}</span>
                                        </div>
                                        {code.description && (
                                            <p className="text-xs text-gray-500 mt-1">{code.description}</p>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1">
                                        {code.type === 'percentage' ? (
                                            <>
                                                <Percent size={14} className="text-orange-600" />
                                                <span className="font-semibold text-orange-600">{code.discountValue}%</span>
                                            </>
                                        ) : (
                                            <>
                                                <DollarSign size={14} className="text-green-600" />
                                                <span className="font-semibold text-green-600">
                                                    Rp {code.discountValue.toLocaleString('id-ID')}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {code.applicableTo === 'both' ? 'All' : code.applicableTo === 'subscription' ? 'Subscription' : 'Credits'}
                                    </p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm">
                                        <span className={`font-semibold ${code.usageCount >= code.usageLimit ? 'text-red-600' : 'text-gray-800'}`}>
                                            {code.usageCount}
                                        </span>
                                        <span className="text-gray-500"> / {code.usageLimit}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                        <div
                                            className={`h-1.5 rounded-full ${code.usageCount >= code.usageLimit ? 'bg-red-500' : 'bg-[#D95D00]'}`}
                                            style={{ width: `${Math.min((code.usageCount / code.usageLimit) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1 text-sm">
                                        <Calendar size={14} className="text-gray-400" />
                                        <span className={isExpired(code.expiryDate) ? 'text-red-600 font-medium' : 'text-gray-700'}>
                                            {formatDate(code.expiryDate)}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {getStatusBadge(code)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleToggleActive(code)}
                                            className={`p-2 rounded-lg transition-colors ${code.isActive
                                                ? 'text-orange-600 hover:bg-orange-50'
                                                : 'text-green-600 hover:bg-green-50'
                                                }`}
                                            title={code.isActive ? 'Deactivate' : 'Activate'}
                                        >
                                            {code.isActive ? <X size={16} /> : <Check size={16} />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingCode({ ...code });
                                                setShowEditModal(true);
                                            }}
                                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCode(code.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {promoCodes.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <Tag size={48} className="mx-auto mb-3 text-gray-300" />
                        <p>No promo codes yet. Click "Create Promo Code" to add one.</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && editingCode && (
                <PromoCodeModal
                    code={editingCode}
                    isNew={showCreateModal}
                    isSaving={isSaving}
                    onSave={handleSaveCode}
                    onClose={() => {
                        setShowCreateModal(false);
                        setShowEditModal(false);
                    }}
                    onChange={setEditingCode}
                />
            )}
        </div>
    );
};

// ============================================
// PROMO CODE MODAL COMPONENT
// ============================================

interface PromoCodeModalProps {
    code: PromoCode;
    isNew: boolean;
    isSaving: boolean;
    onSave: () => void;
    onClose: () => void;
    onChange: (code: PromoCode) => void;
}

const PromoCodeModal: React.FC<PromoCodeModalProps> = ({
    code,
    isNew,
    isSaving,
    onSave,
    onClose,
    onChange
}) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#D95D00] to-[#FF8C00] p-6 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">
                        {isNew ? 'Create Promo Code' : 'Edit Promo Code'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Promo Code *
                        </label>
                        <input
                            type="text"
                            value={code.code}
                            onChange={(e) => onChange({ ...code, code: e.target.value.toUpperCase() })}
                            disabled={!isNew}
                            placeholder="e.g., WELCOME2024"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent uppercase disabled:bg-gray-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description (Optional)
                        </label>
                        <input
                            type="text"
                            value={code.description || ''}
                            onChange={(e) => onChange({ ...code, description: e.target.value })}
                            placeholder="e.g., Welcome bonus for new users"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Discount Type
                            </label>
                            <select
                                value={code.type}
                                onChange={(e) => onChange({ ...code, type: e.target.value as 'percentage' | 'fixed' })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed Amount (IDR)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Discount Value *
                            </label>
                            <input
                                type="number"
                                value={code.discountValue}
                                onChange={(e) => onChange({ ...code, discountValue: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Usage Limit
                            </label>
                            <input
                                type="number"
                                value={code.usageLimit}
                                onChange={(e) => onChange({ ...code, usageLimit: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Expiry Date
                            </label>
                            <input
                                type="date"
                                value={code.expiryDate.toISOString().split('T')[0]}
                                onChange={(e) => onChange({ ...code, expiryDate: new Date(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Applicable To
                        </label>
                        <select
                            value={code.applicableTo}
                            onChange={(e) => onChange({ ...code, applicableTo: e.target.value as 'subscription' | 'credits' | 'both' })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                        >
                            <option value="both">Both (Subscription & Credits)</option>
                            <option value="subscription">Subscription Only</option>
                            <option value="credits">Credits Only</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={code.isActive}
                            onChange={(e) => onChange({ ...code, isActive: e.target.checked })}
                            className="w-4 h-4 text-[#D95D00] border-gray-300 rounded focus:ring-[#D95D00]"
                        />
                        <label className="text-sm font-medium text-gray-700">Active</label>
                    </div>

                    {/* Preview */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-600 mb-2">PREVIEW:</p>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-gray-800 text-lg">{code.code || 'CODE'}</p>
                                <p className="text-sm text-gray-600">
                                    {code.type === 'percentage' ? `${code.discountValue}% OFF` : `Rp ${code.discountValue.toLocaleString('id-ID')} OFF`}
                                </p>
                            </div>
                            <div className="text-right text-xs text-gray-500">
                                <p>Limit: {code.usageLimit} uses</p>
                                <p>Expires: {formatDate(code.expiryDate)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-gray-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                {isNew ? 'Create Code' : 'Save Changes'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
};

export default PricingManagerPage;
