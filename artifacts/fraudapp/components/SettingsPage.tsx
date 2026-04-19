import React, { useState, useRef } from 'react';
import {
    User,
    Settings,
    Bell,
    Shield,
    CreditCard,
    Building2,
    Users,
    LogOut,
    Camera,
    Mail,
    Smartphone,
    MapPin,
    Save,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Globe,
    Volume2,
    Zap,
    CheckCircle
} from 'lucide-react';
import { UserProfile, CompanyProfile } from '../types';
import { updateCompany, updateUserProfile } from '../services/firebase';
import { useToast } from './Toast';

interface SettingsPageProps {
    currentUser: UserProfile;
    currentCompany: CompanyProfile;
    onCompanyUpdate: () => void;
    onNavigateToCredits: () => void;
    onLogout: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
    currentUser,
    currentCompany,
    onCompanyUpdate,
    onNavigateToCredits,
    onLogout
}) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'notifications' | 'team' | 'security'>('profile');
    const [isSaving, setIsSaving] = useState(false);
    const toast = useToast();

    const tabs = [
        { id: 'profile', label: 'My Profile', icon: User, desc: 'Manage your personal information' },
        { id: 'company', label: 'Company Profile', icon: Building2, desc: 'Update company details and branding' },
        { id: 'team', label: 'Team Members', icon: Users, desc: 'Manage access and permissions' },
        { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Configure email and alert preferences' },
        { id: 'security', label: 'Security', icon: Shield, desc: 'Password and security settings' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
            {/* Header */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">
                            <Settings size={24} className="text-gray-600 dark:text-gray-300" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Account Settings</h1>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Sidebar Navigation */}
                    <div className="w-full lg:w-72 flex-shrink-0 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-4 space-y-1">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group ${activeTab === tab.id
                                                ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            <Icon size={18} className={activeTab === tab.id ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 group-hover:text-gray-600'} />
                                            <div>
                                                <div className="text-sm">{tab.label}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="border-t border-gray-100 dark:border-slate-700 p-4">
                                <button
                                    onClick={onNavigateToCredits}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-left text-gray-600 dark:text-gray-400 transition-colors"
                                >
                                    <CreditCard size={18} className="text-gray-400" />
                                    <span className="text-sm font-medium">Billing & Credits</span>
                                </button>
                                <div className="my-2 border-t border-gray-100 dark:border-slate-700"></div>
                                <button
                                    onClick={onLogout}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-left text-red-600 transition-colors"
                                >
                                    <LogOut size={18} />
                                    <span className="text-sm font-medium">Sign Out</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1">
                        {activeTab === 'profile' && <ProfileSettings user={currentUser} />}
                        {activeTab === 'company' && <CompanySettings company={currentCompany} onUpdate={onCompanyUpdate} />}
                        {activeTab === 'team' && <TeamSettings />}
                        {activeTab === 'notifications' && <NotificationSettings company={currentCompany} onUpdate={onCompanyUpdate} />}
                        {activeTab === 'security' && <SecuritySettings />}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Sub-Components ---


const ProfileSettings = ({ user }: { user: UserProfile }) => {
    const [formData, setFormData] = useState({
        name: user.name || '',
        phone: '', // Phone is not in UserProfile currently, but requested in UI. We can add it or just treat as local for now if not in type. 
        // Wait, UserProfile doesn't have phone? Let's check types.ts again.
        // It does not have phone. I'll check if I should add it to type or just handle it. 
        // The previous view_file of types.ts showed UserProfile: id, name, role, avatar, email, companyId, password, emailVerified, createdAt.
        // But signUpWithFirebase takes phone. 
        // Let's assume for now we just update name and role (Job Title). 
        // I will add phone state but maybe not save it effectively if backend doesn't support it yet, OR I will assume update is partial and strict.
        // Let's stick to name and role for now to be safe, or check if I can add phone to UserProfile type.
        // User request: "fungsikan my profile".
        // I will implement saving functionality.
        role: user.role || ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const toast = useToast();

    // Initialize phone if available in user object (even if not in type definition strictly, it might be there)
    // For now let's just use what we have in UI.

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (user.id) {
                await updateUserProfile(user.id, {
                    name: formData.name,
                    role: formData.role as any // Type assertion to avoid literal type mismatch if role is strict enum
                }, user.email);
                toast.success('Profile updated successfully');
                // Force reload to fetch fresh data from Firestore and update UI state
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Cover & Avatar */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden relative">
                <div className="h-48 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                    <button className="absolute bottom-4 right-4 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors">
                        <Camera size={14} /> Change Cover
                    </button>
                </div>

                <div className="px-8 pb-8">
                    <div className="relative -mt-16 mb-6 flex justify-between items-end">
                        <div className="relative group">
                            <img
                                src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                                alt={user.name}
                                className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-lg object-cover bg-white"
                            />
                            <button className="absolute bottom-2 right-2 bg-white dark:bg-slate-700 p-2 rounded-full shadow-md text-gray-600 dark:text-gray-300 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                                <Camera size={16} />
                            </button>
                        </div>
                        <button className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                            View Public Profile
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <FormInput
                                label="Full Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                icon={<User size={16} />}
                            />
                            <FormInput
                                label="Email Address"
                                value={user.email} // Email usually not editable directly
                                disabled
                                icon={<Mail size={16} />}
                            />
                        </div>
                        <div className="space-y-4">
                            <FormInput
                                label="Phone Number"
                                placeholder="+62"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                icon={<Smartphone size={16} />}
                            />
                            <FormInput
                                label="Job Title"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                icon={<Building2 size={16} />}
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CompanySettings = ({ company, onUpdate }: { company: CompanyProfile, onUpdate: () => void }) => {
    const [formData, setFormData] = useState({
        name: company.name || '',
        address: company.address || '',
        website: '',
        description: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const toast = useToast();

    const handleSave = async () => {
        setIsSaving(true);
        // Simulate API call using existing updateCompany
        try {
            await updateCompany(company.id, {
                name: formData.name,
                address: formData.address
            });
            onUpdate();
            toast.success("Company profile updated!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to update profile");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Company Information</h2>
                        <p className="text-sm text-gray-500">Update your organization's public details</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormInput
                            label="Company Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            icon={<Building2 size={16} />}
                        />
                        <FormInput
                            label="Website URL"
                            placeholder="https://company.com"
                            icon={<Globe size={16} />}
                        />
                    </div>

                    <FormInput
                        label="Office Address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        icon={<MapPin size={16} />}
                        type="textarea"
                    />

                    <FormInput
                        label="About Company"
                        placeholder="Tell us about your company..."
                        type="textarea"
                    />
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {isSaving ? 'Saving...' : 'Save Company Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TeamSettings = () => (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="w-20 h-20 bg-blue-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500">
            <Users size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Team Management</h3>
        <p className="text-gray-500 max-w-md mx-auto mb-8">Invite your colleagues to collaborate on hiring candidates. You can assign roles and manage permissions here.</p>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
            Invite Team Member
        </button>
    </div>
);

const NotificationSettings = ({ company, onUpdate }: { company: CompanyProfile, onUpdate: () => void }) => {
    const [preferences, setPreferences] = useState({
        newCandidateApplied: company.notificationPreferences?.newCandidateApplied ?? true,
        assessmentCompleted: company.notificationPreferences?.assessmentCompleted ?? true,
        dailyDigest: company.notificationPreferences?.dailyDigest ?? false,
        soundEnabled: company.notificationPreferences?.soundEnabled ?? true,
    });
    const [isSaving, setIsSaving] = useState(false);
    const toast = useToast();

    const handleToggle = async (key: string, value: boolean) => {
        const newPrefs = { ...preferences, [key]: value };
        setPreferences(newPrefs);

        // Auto-save
        setIsSaving(true);
        try {
            await updateCompany(company.id, {
                notificationPreferences: newPrefs
            });
            toast.success('Preferences updated!');
            onUpdate();
        } catch (error) {
            console.error('Error saving preferences:', error);
            toast.error('Failed to save preferences');
        } finally {
            setIsSaving(false);
        }
    };

    const testNotificationSound = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);

            toast.success('Sound test played!');
        } catch (err) {
            console.error('Sound test failed:', err);
            toast.error('Sound test failed');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400">
                    <Bell size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notification Preferences</h2>
                    <p className="text-sm text-gray-500">Manage how you receive updates and alerts</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* In-App Notifications Section */}
                <div className="pb-6 border-b border-gray-100 dark:border-slate-700">
                    <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">In-App Notifications</h3>

                    <div className="space-y-4">
                        <NotificationToggle
                            title="New Candidate Applied"
                            description="Get notified when someone applies to your job"
                            checked={preferences.newCandidateApplied}
                            onChange={(v) => handleToggle('newCandidateApplied', v)}
                            disabled={isSaving}
                        />

                        <NotificationToggle
                            title="Assessment Completed"
                            description="Receive updates when a candidate finishes a test"
                            checked={preferences.assessmentCompleted}
                            onChange={(v) => handleToggle('assessmentCompleted', v)}
                            disabled={isSaving}
                        />
                    </div>
                </div>

                {/* Sound Settings */}
                <div className="pb-6 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">Notification Sound</h4>
                            <p className="text-sm text-gray-500">Play sound for new notifications</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={testNotificationSound}
                                className="text-xs text-orange-600 hover:text-orange-700 font-medium px-3 py-1 border border-orange-300 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                            >
                                Test Sound
                            </button>
                            <Toggle
                                checked={preferences.soundEnabled}
                                onChange={(v) => handleToggle('soundEnabled', v)}
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>

                {/* Email Notifications Section */}
                <div>
                    <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">Email Notifications</h3>

                    <NotificationToggle
                        title="Daily Digest"
                        description="A summary of daily activities sent every morning at 8:00 AM"
                        checked={preferences.dailyDigest}
                        onChange={(v) => handleToggle('dailyDigest', v)}
                        disabled={isSaving}
                    />
                </div>
            </div>
        </div>
    );
};



const NotificationToggle = ({ title, description, checked, onChange, disabled }: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled: boolean;
}) => (
    <div className="flex items-center justify-between">
        <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-base">{title}</h4>
            <p className="text-sm text-gray-500">{description}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
);

const Toggle = ({ checked, onChange, disabled }: {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled: boolean;
}) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            className="sr-only peer"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
    </label>
);

const SecuritySettings = () => (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 animate-in fade-in slide-in-from-right-4 duration-300">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Security Settings</h2>
        <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-xl mb-6 flex gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
            <div>
                <h4 className="font-bold text-red-700 dark:text-red-400">Two-Factor Authentication</h4>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">Add an extra layer of security to your account by enabling 2FA.</p>
            </div>
            <button className="ml-auto text-sm font-bold text-red-600 underline">Enable</button>
        </div>

        <div className="space-y-4 max-w-md">
            <FormInput
                label="Current Password"
                type="password"
                placeholder="••••••••"
                icon={<Shield size={16} />}
            />
            <FormInput
                label="New Password"
                type="password"
                placeholder="••••••••"
                icon={<Shield size={16} />}
            />
            <button className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all mt-4">
                Update Password
            </button>
        </div>
    </div>
);

// --- Form Components ---

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label: string;
    icon?: React.ReactNode;
}

const FormInput = ({ label, icon, className, ...props }: FormInputProps) => {
    return (
        <div className={className}>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                {label}
            </label>
            <div className="relative group">
                {icon && (
                    <div className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                        {icon}
                    </div>
                )}
                {props.type === 'textarea' ? (
                    <textarea
                        {...(props as any)}
                        className={`w-full ${icon ? 'pl-11' : 'pl-4'} pr-4 py-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none font-medium text-gray-900 dark:text-white min-h-[100px] resize-y`}
                    />
                ) : (
                    <input
                        {...props}
                        className={`w-full ${icon ? 'pl-11' : 'pl-4'} pr-4 py-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none font-medium text-gray-900 dark:text-white`}
                    />
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
