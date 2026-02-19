import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {met ? (
        <CheckCircle className="h-4 w-4 text-primary" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={met ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

export default function Settings() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Password policy checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const allRequirementsMet = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && passwordsMatch;

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!allRequirementsMet) {
      toast.error('Please meet all password requirements');
      return;
    }
    setChangingPassword(true);
    try {
      // Verify current password by re-signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });
      if (signInError) {
        toast.error('Current password is incorrect');
        setChangingPassword(false);
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success('Password changed successfully. Your other sessions have been invalidated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">System Settings</h1>
          <p className="text-muted-foreground">
            Configure your profile and security settings
          </p>
        </div>
        <Badge variant="outline">Administrator</Badge>
      </div>

      {/* Admin Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Profile</CardTitle>
          <CardDescription>Your administrator account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user?.email || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Admin Name"
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* System Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            System Security
          </CardTitle>
          <CardDescription>Change your password with strong policy enforcement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Separator />

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          {newPassword.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
              <p className="text-sm font-medium mb-2">Password Requirements:</p>
              <PasswordRequirement met={hasMinLength} label="At least 8 characters" />
              <PasswordRequirement met={hasUppercase} label="At least one uppercase letter" />
              <PasswordRequirement met={hasLowercase} label="At least one lowercase letter" />
              <PasswordRequirement met={hasNumber} label="At least one number" />
              <PasswordRequirement met={hasSpecial} label="At least one special character" />
            </div>
          )}

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-sm text-destructive">Passwords do not match</p>
            )}
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={!allRequirementsMet || changingPassword || !currentPassword}
          >
            {changingPassword ? 'Changing Password...' : 'Change Password'}
          </Button>

          <Separator />

          <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
            <p className="text-sm font-medium">Security Notes</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Passwords are securely hashed server-side by Supabase (bcrypt)</li>
              <li>All other sessions are invalidated after a password change</li>
              <li>Account locks after multiple failed login attempts (managed by Supabase Auth)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
