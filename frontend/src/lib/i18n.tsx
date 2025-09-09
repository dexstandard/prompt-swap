/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ru';

const translations: Record<Lang, Record<string, string>> = {
  en: {
    online: 'Online',
    offline: 'Offline',
    agents: 'Agents',
    keys: 'Keys',
    settings: 'Settings',
    users: 'Users',
    terms: 'Terms',
    privacy: 'Privacy',
    terms_title: 'Terms of Use',
    terms_p1:
      'PromptSwap is open source software provided "as is" without warranties or guarantees of any kind. Use it at your own risk.',
    terms_p2:
      'You are free to review the source code and run your own instance on your infrastructure. The code is available at ',
    terms_link: 'this GitHub repository',
    terms_p3:
      'By using the service you agree that the authors are not liable for any damages.',
    privacy_title: 'Privacy Policy',
    privacy_p1:
      'We collect only the information required to run the service. When you sign in with Google we record your Google account ID. Your email is stored encrypted and used only for platform-related notifications. Agent configuration data and optional two-factor authentication secrets are also saved.',
    privacy_p2:
      'API keys for AI providers and exchanges, as well as your email address, are encrypted using a server-side password before being saved in our database. These keys are used solely to make requests on your behalf and are never shared with third parties.',
    privacy_p3:
      'You may delete your API keys or disable two-factor authentication at any time from the application settings.',
    login_prompt: 'Please log in.',
    loading: 'Loading...',
    '2fa_enabled': 'Two-factor authentication is enabled.',
    scan_qr: 'Scan this QR code with Google Authenticator and enter the code.',
    setup_2fa: 'Setup 2FA',
    enable: 'Enable',
    disable: 'Disable',
    code: 'Code',
    language: 'Language',
    english: 'English',
    russian: 'Russian',
    api_keys_notice:
      'Your API keys are encrypted using AES-256 and stored only on our server. They are decrypted solely when needed to call providers and are never shared.',
    openai_api_key: 'OpenAI API Key',
    openai_api_key_shared: 'OpenAI API Key (Shared)',
    binance_api_credentials: 'Binance API Credentials',
    edit: 'Edit',
    delete: 'Delete',
    share: 'Share',
    revoke: 'Revoke',
    api_key: 'API key',
    api_secret: 'API secret',
    video_guide: 'Video guide',
    all_fields_required:
      'All fields are required and must be at least 10 characters',
    update: 'Update',
    save: 'Save',
    cancel: 'Cancel',
    delete_key_confirm: 'Deleting this key will stop all active agents. Continue?',
    shared_by_admin: 'Shared by admin',
    enter_email_share: 'Enter email to share with',
    select_model: 'Select model:',
    failed_fetch_models: 'Failed to fetch models',
    enter_email_revoke: 'Enter email to revoke',
    loading_balance: 'Loading balance...',
    total_balance: 'Total balance:',
    whitelist_ip: 'Whitelist IP:',
    copied: 'Copied to clipboard',
    copy_ip: 'Copy IP',
    key_verification_failed: 'Key verification failed',
  },
  ru: {
    online: 'Онлайн',
    offline: 'Офлайн',
    agents: 'Агенты',
    keys: 'Ключи',
    settings: 'Настройки',
    users: 'Пользователи',
    terms: 'Условия',
    privacy: 'Конфиденциальность',
    terms_title: 'Условия использования',
    terms_p1:
      'PromptSwap — программное обеспечение с открытым исходным кодом, предоставляется «как есть» без каких-либо гарантий. Используйте на свой страх и риск.',
    terms_p2:
      'Вы можете изучать исходный код и запускать собственный экземпляр на своей инфраструктуре. Код доступен в ',
    terms_link: 'этом репозитории GitHub',
    terms_p3:
      'Используя сервис, вы соглашаетесь, что авторы не несут ответственности за любые убытки.',
    privacy_title: 'Политика конфиденциальности',
    privacy_p1:
      'Мы собираем только информацию, необходимую для работы сервиса. При входе через Google мы сохраняем идентификатор вашей учетной записи Google. Ваш email хранится в зашифрованном виде и используется только для уведомлений, связанных с платформой. Также сохраняются данные конфигурации агентов и, при необходимости, секреты двухфакторной аутентификации.',
    privacy_p2:
      'API‑ключи поставщиков ИИ и бирж, а также ваш email шифруются серверным паролем перед сохранением в нашей базе данных. Эти ключи используются исключительно для запросов от вашего имени и никогда не передаются третьим лицам.',
    privacy_p3:
      'Вы можете удалить свои API‑ключи или отключить двухфакторную аутентификацию в настройках приложения в любое время.',
    login_prompt: 'Пожалуйста, войдите.',
    loading: 'Загрузка...',
    '2fa_enabled': 'Двухфакторная аутентификация включена.',
    scan_qr: 'Сканируйте этот QR-код в Google Authenticator и введите код.',
    setup_2fa: 'Настроить 2FA',
    enable: 'Включить',
    disable: 'Отключить',
    code: 'Код',
    language: 'Язык',
    english: 'Английский',
    russian: 'Русский',
    api_keys_notice:
      'Ваши API‑ключи шифруются с помощью AES‑256 и хранятся только на нашем сервере. Они дешифруются только при вызове провайдеров и никогда не передаются третьим лицам.',
    openai_api_key: 'API‑ключ OpenAI',
    openai_api_key_shared: 'API‑ключ OpenAI (общий)',
    binance_api_credentials: 'Учётные данные Binance API',
    edit: 'Редактировать',
    delete: 'Удалить',
    share: 'Поделиться',
    revoke: 'Отозвать',
    api_key: 'API‑ключ',
    api_secret: 'API‑секрет',
    video_guide: 'Видео‑инструкция',
    all_fields_required: 'Все поля обязательны и должны содержать минимум 10 символов',
    update: 'Обновить',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete_key_confirm: 'Удаление ключа остановит всех активных агентов. Продолжить?',
    shared_by_admin: 'Предоставлено администратором',
    enter_email_share: 'Введите email для доступа',
    select_model: 'Выберите модель:',
    failed_fetch_models: 'Не удалось получить список моделей',
    enter_email_revoke: 'Введите email для отзыва',
    loading_balance: 'Загрузка баланса...',
    total_balance: 'Общий баланс:',
    whitelist_ip: 'Разрешённый IP:',
    copied: 'Скопировано в буфер',
    copy_ip: 'Скопировать IP',
    key_verification_failed: 'Проверка ключа не прошла',
  },
};

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
}>({
  lang: 'en',
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    (localStorage.getItem('lang') as Lang) || 'en',
  );

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('lang', l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslation() {
  const { lang } = useLanguage();
  return (key: string) => translations[lang][key] ?? key;
}

