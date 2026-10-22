import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// the translations
// (tip move them in a JSON file and import them,
// or even better, manage them separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
    en: {
        translation: {
            "welcome": "Welcome to React",
            "dashboard": "Dashboard",
            "campaigns": "Campaigns",
            "templates": "Templates",
            "inbox": "Inbox",
            "contacts": "Contacts",
            "accounts": "Accounts",
            "profile": "Profile",
            "signIn": "Sign In",
            "signOut": "Sign Out",
            "connectedNumbers": "Connected Numbers",
        }
    },
    ar: {
        translation: {
            "welcome": "مرحباً بك في ريأكت",
            "dashboard": "لوحة التحكم",
            "campaigns": "حملة اعلانية",
            "templates": "القوالب",
            "inbox": "صندوق الملاسلات",
            "contacts": "جهات الاتصال",
            "accounts": "حسابات",
            "profile": "الملف الشخصى",
            "signIn": "تسجيل دخول",
            "signOut": "تسجيل خروج",
            "connectedNumbers": "الحسابات المتصلة",
        }
    }
};


i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: "en", // language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
        // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
        // if you're using a language detector, do not define the lng option

        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;