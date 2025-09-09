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

