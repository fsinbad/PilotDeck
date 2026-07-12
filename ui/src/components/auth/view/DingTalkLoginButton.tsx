import { useTranslation } from 'react-i18next';

/**
 * DingTalk SSO login button.
 * Redirects the browser to the backend DingTalk OAuth2 initiation endpoint
 * (`/api/auth/dingtalk`) when clicked.
 */
export default function DingTalkLoginButton() {
  const { t } = useTranslation('auth');

  const handleClick = () => {
    window.location.href = '/api/auth/dingtalk';
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 font-medium text-white transition-colors duration-200"
        style={{ backgroundColor: '#1677FF' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#0958d9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#1677FF';
        }}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13 2L4 13h6l-1 9 9-11h-6l1-9z" />
        </svg>
        {t('login.dingtalk', { defaultValue: 'Sign in with DingTalk' })}
      </button>
    </div>
  );
}
