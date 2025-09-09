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
    language: 'Language',
    please_log_in: 'Please log in.',
    loading: 'Loading...',
    twofa_enabled: 'Two-factor authentication is enabled.',
    code: 'Code',
    disable: 'Disable',
    scan_qr_prompt: 'Scan this QR code with Google Authenticator and enter the code.',
    secret: 'Secret',
    copy_secret: 'Copy secret',
    copied: 'Copied to clipboard',
    enable: 'Enable',
    setup_2fa: 'Setup 2FA',
    api_keys_notice:
      'Your API keys are encrypted using AES-256 and stored only on our server. They are decrypted solely when needed to call providers and are never shared.',
    openai_api_key: 'OpenAI API Key',
    openai_api_key_shared: 'OpenAI API Key (Shared)',
    binance_api_credentials: 'Binance API Credentials',
    binance_balances: 'Binance Balances',
    my_agents: 'My Agents',
    only_active: 'Only Active',
    please_log_in_agents: 'Please log in to view your agents.',
    no_agents_yet: "You don't have any agents yet.",
    tokens: 'Tokens',
    balance_usd: 'Balance (USD)',
    pnl_usd: 'PnL (USD)',
    model: 'Model',
    interval: 'Interval',
    status: 'Status',
    prev: 'Prev',
    next: 'Next',
    delete_agent_prompt: 'Delete this agent?',
    agent_deleted: 'Agent deleted',
    failed_delete_agent: 'Failed to delete agent',
    login_failed: 'Login failed',
    enter_2fa_code: 'Enter 2FA code',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete_agent: 'Delete agent',
    view_agent: 'View agent',
    twofa_enabled_success: '2FA enabled',
    twofa_disabled_success: '2FA disabled',
    failed_start_2fa_setup: 'Failed to start 2FA setup',
    failed_enable_2fa: 'Failed to enable 2FA',
    failed_disable_2fa: 'Failed to disable 2FA',
    too_many_requests: 'Too many requests. Please try again later.',
    api_key: 'API key',
    api_secret: 'API secret',
    video_guide: 'Video guide',
    fields_required_min_length: 'All fields are required and must be at least 10 characters',
    update: 'Update',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    delete_key_confirm: 'Deleting this key will stop all active agents. Continue?',
    shared_by_admin: 'Shared by admin',
    loading_balance: 'Loading balance...',
    total_balance: 'Total balance:',
    whitelist_ip: 'Whitelist IP:',
    share: 'Share',
    revoke: 'Revoke',
    enter_email_share: 'Enter email to share with',
    select_model: 'Select model',
    failed_fetch_models: 'Failed to fetch models',
    enter_email_revoke: 'Enter email to revoke',
    key_verification_failed: 'Key verification failed',
    copy_ip: 'Copy IP',
    balance: 'Balance',
    pnl: 'PnL',
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
    language: 'Язык',
    please_log_in: 'Пожалуйста, войдите.',
    loading: 'Загрузка...',
    twofa_enabled: 'Двухфакторная аутентификация включена.',
    code: 'Код',
    disable: 'Отключить',
    scan_qr_prompt: 'Отсканируйте этот QR-код в Google Authenticator и введите код.',
    secret: 'Секрет',
    copy_secret: 'Скопировать секрет',
    copied: 'Скопировано в буфер обмена',
    enable: 'Включить',
    setup_2fa: 'Настроить 2FA',
    api_keys_notice:
      'Ваши API‑ключи шифруются с помощью AES-256 и хранятся только на нашем сервере. Они расшифровываются только при необходимости обращения к провайдерам и никогда не передаются третьим лицам.',
    openai_api_key: 'OpenAI API ключ',
    openai_api_key_shared: 'OpenAI API ключ (общий)',
    binance_api_credentials: 'Учётные данные Binance API',
    binance_balances: 'Балансы Binance',
    my_agents: 'Мои агенты',
    only_active: 'Только активные',
    please_log_in_agents: 'Пожалуйста, войдите, чтобы увидеть ваших агентов.',
    no_agents_yet: 'У вас пока нет агентов.',
    tokens: 'Токены',
    balance_usd: 'Баланс (USD)',
    pnl_usd: 'PnL (USD)',
    model: 'Модель',
    interval: 'Интервал',
    status: 'Статус',
    prev: 'Пред',
    next: 'След',
    delete_agent_prompt: 'Удалить этого агента?',
    agent_deleted: 'Агент удалён',
    failed_delete_agent: 'Не удалось удалить агента',
    login_failed: 'Не удалось войти',
    enter_2fa_code: 'Введите код 2FA',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    delete_agent: 'Удалить агента',
    view_agent: 'Просмотреть агента',
    twofa_enabled_success: '2FA включена',
    twofa_disabled_success: '2FA отключена',
    failed_start_2fa_setup: 'Не удалось начать настройку 2FA',
    failed_enable_2fa: 'Не удалось включить 2FA',
    failed_disable_2fa: 'Не удалось отключить 2FA',
    too_many_requests: 'Слишком много запросов. Повторите позже.',
    api_key: 'API ключ',
    api_secret: 'API секрет',
    video_guide: 'Видео инструкция',
    fields_required_min_length: 'Все поля обязательны и должны быть не менее 10 символов',
    update: 'Обновить',
    save: 'Сохранить',
    edit: 'Редактировать',
    delete: 'Удалить',
    delete_key_confirm: 'Удаление этого ключа остановит всех активных агентов. Продолжить?',
    shared_by_admin: 'Предоставлено администратором',
    loading_balance: 'Загрузка баланса...',
    total_balance: 'Общий баланс:',
    whitelist_ip: 'Белый список IP:',
    share: 'Поделиться',
    revoke: 'Отозвать',
    enter_email_share: 'Введите email для совместного использования',
    select_model: 'Выберите модель',
    failed_fetch_models: 'Не удалось получить список моделей',
    enter_email_revoke: 'Введите email для отзыва',
    key_verification_failed: 'Проверка ключа не удалась',
    copy_ip: 'Скопировать IP',
    balance: 'Баланс',
    pnl: 'PnL',
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

