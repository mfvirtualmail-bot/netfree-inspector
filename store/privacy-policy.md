# Privacy Policy — NetFree Inspector

**Last updated:** 2026-07-21

---

## English

### Summary (TL;DR)

NetFree Inspector shows you which requests on a page were blocked by the NetFree content filter, and — only when you choose to file a review request — helps you send that request to NetFree. It uses **no analytics, no tracking, no advertising, and no third-party servers**, and it creates no accounts of its own. Detection happens locally in your browser. The only data that ever leaves your browser is the review request **you explicitly choose to send to NetFree** (the content-filter provider you already use): the blocked link(s), the page you were on, an optional recording of your recent traffic, and — only if you start one — an optional screen recording. **Nothing is ever sent to the extension's developer or to any third party.**

---

### 1. What the extension does

NetFree Inspector detects HTTP 418 responses — NetFree's block signal ([https://netfree.link](https://netfree.link)) — on the current tab and lists the blocked URLs, their type, and NetFree's block reason. Optionally, it helps you file a review request to NetFree for a blocked site, file, or video — including, at your choice, a recording of your recent network traffic and/or a screen recording — so NetFree can review and approve it.

### 2. Permissions the extension uses

- **`webRequest`** — observe HTTP responses to detect 418 blocks.
- **`tabs`** — associate blocks with the correct tab, and open NetFree's request form.
- **`storage`** — hold block data locally between the background worker and the popup, and remember your language.
- **`webNavigation`** — detect navigation so stale block data can be cleared.
- **`alarms`** — schedule housekeeping of stored block data and keep the background worker responsive.
- **`desktopCapture`** — only when you start a screen recording, to capture the screen area you pick.
- **`scripting`** — inject a small helper on NetFree's request page to pre-fill the form for you.
- **`system.display`** — position the screen-recording helper window correctly across monitors.
- **`declarativeNetRequestWithHostAccess`** — set the correct `Origin` header on the single request to NetFree's traffic stream so NetFree returns your live traffic data (a session-scoped rule limited to `netfree.link`).
- **`<all_urls>` host permission** — NetFree can block on any site, so the extension must observe responses on all URLs. It reads status codes and URLs; it does not read or modify page content for detection.

### 3. Data processed locally (does not leave your browser on its own)

- URLs that returned HTTP 418 (blocked)
- The resource type and HTTP status of blocked requests
- NetFree's block reason code (read from the 418 response)
- The domain/URL of the current tab (shown in the popup and used to pre-fill a request)
- Your language preference (stored in `chrome.storage.local`)

Detection data is held in transient session storage and cleared when you close the browser or navigate away.

To read NetFree's block reason, the extension may re-request a blocked URL so it can read the block code from NetFree's 418 response. These requests go to the same sites you were already visiting and carry no added personal data.

### 4. Data sent to NetFree — only when you file a review request

**NetFree Inspector never uploads anything on its own.** When you explicitly choose to file a review request, and only then, it sends the following to **NetFree** (`netfree.link` — the content-filter provider you already use), using your existing NetFree session:

1. **The blocked link(s), the page URL you were on, and the description** shown in the request form.
2. **A "traffic recording"** — a list of your recent network requests as seen by NetFree's own filter, captured from NetFree's live traffic stream. This is the same information NetFree's own "record traffic" request tool collects; the extension simply builds it for you. (Uploaded to `netfree.link/api/user/save-traffic-record`.)
3. **A screen recording** — *only if you start one* — of the screen area you choose. (Uploaded to `netfree.link/api/upload-file`, marked private.)

This data goes **only to NetFree**, only to process the review request you asked to send. It is not sent to the extension's developer or to any other party.

### 5. What the extension never does

- No analytics, tracking pixels, advertising, or fingerprinting.
- No third-party servers other than NetFree (your filter provider) and NetFree's public logo image.
- No selling or sharing of data with third parties.
- No accounts created by the extension; it relies on your existing NetFree login.

### 6. Data storage and retention

Detection data lives only in `chrome.storage.session` (in-memory, cleared on browser close and on navigation). Language preference lives in `chrome.storage.local`. Any recordings and request data you choose to send are held by NetFree under NetFree's own privacy terms, as part of your support request to them.

### 7. Children's privacy

The extension does not knowingly collect information from anyone, including children under 13.

### 8. Changes to this policy

If this policy changes, the updated version is published in the extension's GitHub repository. The "Last updated" date reflects the most recent revision.

### 9. Contact

For questions, open an issue on the GitHub repository:
**https://github.com/mfvirtualmail-bot/netfree-inspector**

---

## עברית

### תקציר

NetFree Inspector מראה לך אילו בקשות בדף נחסמו על ידי נט פרי, ורק כאשר תבחר לשלוח בקשת בדיקה — עוזר לך לשלוח אותה לנט פרי. **אין אנליטיקס, אין מעקב, אין פרסום ואין שרתי צד שלישי**, וההרחבה אינה יוצרת חשבונות משלה. הזיהוי מתבצע מקומית בדפדפן. המידע היחיד שיוצא מהדפדפן הוא בקשת הבדיקה **שאתה בוחר במפורש לשלוח לנט פרי** (ספק הסינון שכבר בשימושך): הקישור/ים החסומים, הדף שבו היית, הקלטת תעבורה אופציונלית, ורק אם תתחיל אחת — הקלטת מסך אופציונלית. **שום דבר לא נשלח למפתח ההרחבה או לצד שלישי כלשהו.**

---

### 1. מה ההרחבה עושה

NetFree Inspector מזהה תגובות HTTP 418 — אות החסימה של נט פרי — בטאב הנוכחי, ומציגה את הכתובות החסומות, סוגן וסיבת החסימה. אופציונלית, היא עוזרת לך לשלוח לנט פרי בקשת בדיקה עבור אתר, קובץ או סרטון חסום — כולל, לפי בחירתך, הקלטה של התעבורה האחרונה שלך ו/או הקלטת מסך — כדי שנט פרי תוכל לבדוק ולאשר.

### 2. הרשאות שההרחבה משתמשת בהן

- **`webRequest`** — לצפות בתגובות HTTP כדי לזהות חסימות 418.
- **`tabs`** — לשייך חסימות לטאב הנכון ולפתוח את טופס הבקשה של נט פרי.
- **`storage`** — לשמור נתוני חסימה מקומית בין רכיב הרקע לפופאפ, ולזכור את שפתך.
- **`webNavigation`** — לזהות ניווט כדי לנקות נתונים ישנים.
- **`alarms`** — לתזמן ניקוי של נתוני החסימה השמורים ולשמור על רכיב הרקע פעיל.
- **`desktopCapture`** — רק כשאתה מתחיל הקלטת מסך, כדי ללכוד את אזור המסך שבחרת.
- **`scripting`** — להזריק רכיב עזר קטן בדף הבקשה של נט פרי כדי למלא עבורך את הטופס.
- **`system.display`** — למקם נכון את חלון עזר ההקלטה בין המסכים.
- **`declarativeNetRequestWithHostAccess`** — להגדיר כותרת `Origin` נכונה בבקשה היחידה לשידור התעבורה של נט פרי, כדי שנט פרי תחזיר את נתוני התעבורה החיים שלך (כלל זמני המוגבל ל-`netfree.link`).
- **הרשאת `<all_urls>`** — נט פרי יכולה לחסום בכל אתר, ולכן ההרחבה חייבת לצפות בתגובות מכל הכתובות. היא קוראת קודי סטטוס וכתובות; היא אינה קוראת או משנה את תוכן הדף לצורך הזיהוי.

### 3. מידע המעובד מקומית (אינו יוצא מהדפדפן מעצמו)

- כתובות שהחזירו HTTP 418 (חסום)
- סוג המשאב וקוד הסטטוס של הבקשות החסומות
- קוד סיבת החסימה של נט פרי (נקרא מתגובת ה-418)
- הדומיין/הכתובת של הטאב הנוכחי (מוצג בפופאפ ומשמש למילוי הבקשה)
- העדפת השפה שלך (נשמרת ב-`chrome.storage.local`)

נתוני הזיהוי נשמרים בזיכרון זמני ונמחקים עם סגירת הדפדפן או מעבר לדף אחר.

כדי לקרוא את סיבת החסימה, ההרחבה עשויה לבקש מחדש כתובת חסומה כדי לקרוא את קוד החסימה מתגובת ה-418 של נט פרי. בקשות אלו נשלחות לאותם אתרים שכבר גלשת בהם ואינן נושאות מידע אישי נוסף.

### 4. מידע הנשלח לנט פרי — רק כאשר אתה שולח בקשת בדיקה

**ההרחבה לעולם אינה מעלה דבר מעצמה.** כאשר אתה בוחר במפורש לשלוח בקשת בדיקה, ורק אז, היא שולחת ל**נט פרי** (`netfree.link` — ספק הסינון שכבר בשימושך), באמצעות החיבור הקיים שלך לנט פרי:

1. **הקישור/ים החסומים, כתובת הדף שבו היית, והתיאור** המופיע בטופס הבקשה.
2. **"הקלטת תעבורה"** — רשימת הבקשות האחרונות שלך כפי שנראות על ידי הפילטר של נט פרי, שנלכדה משידור התעבורה החי של נט פרי. זהו אותו מידע שכלי "הקלטת התעבורה" של נט פרי אוסף; ההרחבה פשוט בונה אותו עבורך. (מועלה ל-`netfree.link/api/user/save-traffic-record`.)
3. **הקלטת מסך** — *רק אם תתחיל אחת* — של אזור המסך שתבחר. (מועלה ל-`netfree.link/api/upload-file`, מסומן כפרטי.)

מידע זה נשלח ל**נט פרי בלבד**, רק כדי לטפל בבקשת הבדיקה ששלחת. הוא אינו נשלח למפתח ההרחבה או לכל גורם אחר.

### 5. מה ההרחבה לעולם אינה עושה

- אין אנליטיקס, פיקסלי מעקב, פרסום או טביעת אצבע.
- אין שרתי צד שלישי מלבד נט פרי (ספק הסינון שלך) ותמונת הלוגו הפומבית של נט פרי.
- אין מכירה או שיתוף של מידע עם צד שלישי.
- ההרחבה אינה יוצרת חשבונות; היא מסתמכת על החיבור הקיים שלך לנט פרי.

### 6. שמירת נתונים

נתוני הזיהוי נמצאים רק ב-`chrome.storage.session` (בזיכרון, נמחקים עם סגירת הדפדפן ובעת ניווט). העדפת השפה נמצאת ב-`chrome.storage.local`. הקלטות ונתוני בקשה שאתה בוחר לשלוח נשמרים אצל נט פרי בכפוף לתנאי הפרטיות של נט פרי, כחלק מפניית התמיכה שלך אליהם.

### 7. פרטיות ילדים

ההרחבה אינה אוספת ביודעין מידע מאף אחד, כולל ילדים מתחת לגיל 13.

### 8. שינויים במדיניות

אם המדיניות תשתנה, הגרסה המעודכנת תפורסם במאגר ה-GitHub של ההרחבה. תאריך "עודכן לאחרונה" משקף את הגרסה העדכנית ביותר.

### 9. יצירת קשר

לשאלות, פתחו Issue במאגר ה-GitHub:
**https://github.com/mfvirtualmail-bot/netfree-inspector**
