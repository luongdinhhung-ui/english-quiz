# 英語クイズ

A phone-friendly English quiz for 高校入試 prep (中3): 慶應義塾高校-level vocabulary, grammar (誤文訂正, 書き換え, 適語補充), and 並べ替え.
The app is plain HTML/JS in `docs/` — no build step.

## Editing questions

All questions are in `docs/questions.csv`. Open it in Excel or Google Sheets.

> ⚠ **Excel: always save as "CSV UTF-8 (コンマ区切り)"**, not plain "CSV".
> Plain CSV on a Japanese PC uses Shift_JIS and the Japanese text becomes 文字化け.
> Google Sheets: ファイル → ダウンロード → カンマ区切り形式 (.csv) is always fine.

Columns:

| column | meaning |
|---|---|
| `type` | `vocab_ej` (English → choose Japanese), `vocab_je` (Japanese → type English), `grammar` (choose the word for `( )`), `order` (並べ替え), `error` (誤文訂正: choose the wrong part), `fill` (type one word for `( )`), `extra` (type the one unnecessary word), `pick` (choose the grammatically correct sentence) |
| `topic` | shown in the トピック menu, e.g. `現在完了`, `動詞` |
| `question` | the word / sentence shown. For `order`, the Japanese sentence |
| `choices` | `vocab_ej`, `grammar`, `error` and `pick` only: options separated by `\|`, e.g. `for\|since\|from\|at`. Must include the answer. Leave empty for other types |
| `answer` | the correct answer. `vocab_je` / `fill`: alternatives separated by `/`, e.g. `maybe/perhaps`. `order`: the full English sentence — it is split into word tiles at spaces, and the final `.` `?` `!` is shown fixed at the end |
| `explanation` | shown after answering (Japanese) |

For `error`, mark the parts in the sentence as `【A …】【B …】…` and list them in the same order in `choices` (`A …\|B …\|…`); they are shown in that order, not shuffled.

If a row has a mistake, the app skips it and shows a warning with the row number on the home screen.

Progress (mistakes, streak, accuracy) is keyed on `type` + `question`, so editing a question's text resets its review status.

## Preview locally

Double-clicking `index.html` won't work (the browser blocks loading the CSV). Instead:

```sh
python3 -m http.server -d docs
```

and open <http://localhost:8000>.

## Publishing on GitHub Pages (first time)

1. Create a new repository on github.com (e.g. `eigo-quiz`). The site will be public.
2. In this folder:
   ```sh
   git add .
   git commit -m "English quiz"
   git branch -M main
   git remote add origin https://github.com/<your-name>/eigo-quiz.git
   git push -u origin main
   ```
3. On GitHub: Settings → Pages → Source: "Deploy from a branch" → Branch `main`, folder `/docs` → Save.
4. After a minute the quiz is at `https://<your-name>.github.io/eigo-quiz/`. Add it to your son's phone home screen.

## Updating questions later

Edit the CSV, then:

```sh
git add docs/questions.csv
git commit -m "Update questions"
git push
```

The site updates within a minute or two.
