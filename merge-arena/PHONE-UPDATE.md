# Telefon yenilənmirsə

GitHub Pages artıq yenidir. Telegram çox vaxt **köhnə Menu Button URL**-ini cache edir.

## 1) Bu linki bir dəfə aç (ən sürətli)
https://wealthia.github.io/wealthia/merge-arena/app/?v=47

Yuxarıda **v47** nişanı görünməlidir. AdsGram möhkəmləndirilib — Shop-da Watch/Quick Charge.

## 2) BotFather Menu Button-u dəyiş
1. Telegram-da `@BotFather` aç
2. `/mybots` → `@MergeArenaBot` (və ya botun)
3. **Bot Settings** → **Menu Button** → **Configure menu button**
4. URL yapışdır:
```
https://wealthia.github.io/wealthia/merge-arena/app/?v=47
```
5. Telegram-ı tam bağla (swipe away) → yenidən aç → botu aç

## 3) Render WEBAPP_URL (əgər bot Render-dən gəlirsə)
Render → `merge-arena-api` → Environment:
```
WEBAPP_URL=https://wealthia.github.io/wealthia/merge-arena/app/?v=47
```
Sonra **Manual Deploy**.
