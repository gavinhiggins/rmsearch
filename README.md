# RMSearch 🤖

> A dedicated English-to-Chinese search engine for **RoboMaster BBS** articles ([bbs.robomaster.com/article](https://bbs.robomaster.com/article)), built for hosting on **GitHub Pages**.

Inspired by [scutrobotlab/rm-search](https://github.com/scutrobotlab/rm-search) ([search.scutbot.cn](https://search.scutbot.cn/)), **RMSearch** allows English-speaking RoboMaster teams and engineers to search Chinese forum articles using English terminology, dictionary mappings, machine translation, attachment checkboxes, and university filters.

---

## 🌟 Key Features

### 1. English to Chinese Dual Search Modes
RoboMaster forum posts are written in Chinese, but non-Chinese speaking teams need to search in English. RMSearch solves this with three intelligent search modes:
* **Smart Hybrid (Default)**: Automatically checks the built-in dictionary first for accurate RoboMaster jargon (e.g. `gimbal` → `云台`, `sentry` → `哨兵`, `infantry` → `步兵`, `supercapacitor` → `超级电容`), and machine-translates any remaining terms.
* **Dictionary Only**: Searches strictly using the exact term map stored in [`data/dictionary.json`](./data/dictionary.json).
* **Machine Translation**: Automatically translates English queries to Simplified Chinese via neural translation.
* **Live Query Preview & Manual Override**: Displays the active Chinese search terms in real-time with a 1-click edit button to manually tweak characters.

### 2. Single-Screen Instant Interface
* **Top Bar**: Search input with instant debounce, query clear, search mode selector, and dictionary viewer.
* **Left Sidebar**: Always accessible filters for attachments, date ranges, and universities.
* **Main Area**: Fast-loading article cards with highlighted keywords, author metadata, cover pictures, and direct links.

### 3. Attachment & Download Checkboxes
Quickly filter posts based on available engineering files:
* 📄 **Has PDF attachment**: Technical reports, design summaries, research papers.
* 📦 **Has ZIP file download**: CAD models, SolidWorks drawings, STEP files, firmware archives.
* ☁️ **Has Baidu Netdisk link**: Open-source releases with download links and extraction codes (`提取码`) copyable in 1 click.

### 4. Date Range & Sorting
* **Earliest Date** / **Latest Date** / **Relevance** sorting.
* **Season Quick-Pills**: `All`, `2026`, `2025`, `2024`, `2023`, `2022`, `2021`, `2020`.
* **Custom Date Range Picker**: Precise Start Date & End Date selection.

### 5. University & School Filters
* Search and filter by 190+ RoboMaster universities (e.g. *SCUT / 华南理工大学*, *SJTU / 上海交通大学*, *HIT / 哈尔滨工业大学*, *HKUST / 香港科技大学*, *Shenzhen University / 深圳大学*).
* Live article count badges for each university.

---

## 🚀 How to Host on GitHub Pages

1. **Push this repository** to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit of RMSearch"
   git branch -M main
   git remote add origin https://github.com/<your-username>/rmsearch.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   * In your repository on GitHub, go to **Settings** → **Pages**.
   * Under **Build and deployment** → **Source**, select **Deploy from a branch**.
   * Set **Branch** to `main` and folder to `/ (root)`.
   * Click **Save**.

3. Your search engine will be live at:
   ```text
   https://<your-username>.github.io/rmsearch/
   ```

---

## 📖 How to Edit the Dictionary

The dictionary is located at [`data/dictionary.json`](./data/dictionary.json). You can edit it directly on GitHub:

```json
{
  "en": ["gimbal", "turret"],
  "zh": "云台",
  "category": "Gimbal"
}
```

* **`en`**: Array of English phrases or abbreviations that users might type.
* **`zh`**: The exact Chinese term to search for in RoboMaster BBS articles.
* **`category`**: Category tag (e.g. `Robots`, `Chassis`, `Gimbal`, `Electrical`, `University`).

---

## 🔄 Keeping Data Updated

A pre-indexed corpus of **4,145 articles (2020 to present)** is bundled directly in `data/articles.json`.

* **Automated Sync**: A GitHub Actions workflow ([`.github/workflows/update-data.yml`](./.github/workflows/update-data.yml)) automatically runs every Monday at 02:00 UTC to crawl new articles and update the repository.
* **Manual Local Sync**: Run `./update_data.ps1` in PowerShell to re-crawl and refresh the dataset anytime.

---

## 📄 Credits & References

* **RoboMaster Official Forum**: [bbs.robomaster.com/article](https://bbs.robomaster.com/article)
* **SCUT RobotLab RM-Search**: [scutrobotlab/rm-search](https://github.com/scutrobotlab/rm-search)
* **RM Translations**: [Notion Term Map](https://app.notion.com/p/rm-translations-320ea4cb0e8880528ea2e97f927e5209)
