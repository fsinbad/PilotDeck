import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthErrorAlert from './AuthErrorAlert';
import AuthInputField from './AuthInputField';
import AuthScreenLayout from './AuthScreenLayout';

type SetupFormState = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
};

const initialState: SetupFormState = {
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
};

/**
 * Validates the account-setup form state.
 * @returns An error message string if validation fails, or `null` when the
 *   form is valid.
 */
function validateSetupForm(formState: SetupFormState): string | null {
  if (!formState.email.trim() || !formState.password || !formState.confirmPassword) {
    return 'Please fill in all required fields.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formState.email.trim())) {
    return 'Please enter a valid email address.';
  }

  if (formState.password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }

  if (formState.password !== formState.confirmPassword) {
    return 'Passwords do not match.';
  }

  return null;
}

/**
 * Account setup / registration form.
 * Uses `autoComplete="new-password"` on password fields so that password
 * managers recognise this as a registration flow and offer to save the new
 * credentials after submission.
 */
export default function SetupForm() {
  const { register } = useAuth();

  const [formState, setFormState] = useState<SetupFormState>(initialState);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback((field: keyof SetupFormState, value: string) => {
    setFormState((previous) => ({ ...previous, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorMessage('');

      const validationError = validateSetupForm(formState);
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }

      setIsSubmitting(true);
      const result = await register(
        formState.email.trim(),
        formState.password,
        formState.username.trim() || undefined,
      );
      if (!result.success) {
        setErrorMessage(result.error);
      }
      setIsSubmitting(false);
    },
    [formState, register],
  );

  return (
    <AuthScreenLayout
      title="Welcome to NukemAI"
      description="Set up your account to get started"
      footerText="Create your account to get started"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInputField
          id="email"
          name="email"
          label="Email"
          value={formState.email}
          onChange={(value) => updateField('email', value)}
          placeholder="Enter your email"
          isDisabled={isSubmitting}
          type="email"
          autoComplete="email"
        />

        <AuthInputField
          id="username"
          name="username"
          label="Display Name (optional)"
          value={formState.username}
          onChange={(value) => updateField('username', value)}
          placeholder="Enter your display name"
          isDisabled={isSubmitting}
          isRequired={false}
          autoComplete="username"
        />

        <AuthInputField
          id="password"
          name="password"
          label="Password"
          value={formState.password}
          onChange={(value) => updateField('password', value)}
          placeholder="Enter your password"
          isDisabled={isSubmitting}
          type="password"
          autoComplete="new-password"
        />

        <AuthInputField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm Password"
          value={formState.confirmPassword}
          onChange={(value) => updateField('confirmPassword', value)}
          placeholder="Confirm your password"
          isDisabled={isSubmitting}
          type="password"
          autoComplete="new-password"
        />

        <AuthErrorAlert errorMessage={errorMessage} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-blue-700 disabled:bg-blue-400"
        >
          {isSubmitting ? 'Setting up...' : 'Create Account'}
        </button>
      </form>
    </AuthScreenLayout>
  );
}
