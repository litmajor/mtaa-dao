# 📚 GitHub Pages Deployment Plan

## Overview

This document outlines the complete setup for deploying MtaaDAO documentation to GitHub Pages, creating a comprehensive documentation hub accessible at `https://litmajor.github.io/mtaa-dao/`

## 🎯 What We're Deploying

### 1. **HTML Whitepaper** (`/whitepaper/`)
- Beautiful dark-themed comprehensive whitepaper
- All current features and architecture
- Interactive navigation
- Mobile-responsive design
- **Source:** `client/public/whitepaper.html`

### 2. **Progress Tracker** (`/progress.html`)
- Real-time project status dashboard
- Animated progress bars
- Feature completion tracking
- Timeline and roadmap
- **Source:** `PROGRESS.html`

### 3. **Technical Guide** (`/book/`)
- mdBook-based technical documentation
- Code examples in Rust
- Architecture deep-dives
- API references
- **Source:** `mtaa-dao-whitepaper/` (mdBook)

### 4. **Rust API Docs** (`/rust-docs/`)
- Auto-generated Rust documentation
- Module documentation
- Struct and trait references
- Code examples
- **Source:** `mtaa-dao-whitepaper/target/doc/`

### 5. **Documentation Hub** (`/`)
- Landing page with links to all documentation
- Beautiful dark-themed interface
- Quick navigation
- **Source:** Auto-generated in workflow

## 📁 Directory Structure

```
docs-output/
├── index.html                    # Documentation hub landing page
├── whitepaper/
│   └── index.html               # HTML whitepaper
├── progress.html                 # Progress tracker
├── book/                        # mdBook output
│   ├── index.html
│   ├── chapter_1.html
│   ├── architecture/
│   │   ├── overview.html
│   │   ├── ai-layer.html
│   │   ├── contracts.html
│   │   ├── vaults.html
│   │   └── blockchain.html
│   └── ...
└── rust-docs/                   # Rust API documentation
    └── mtaa_dao/
        ├── index.html
        ├── governance/
        ├── vault/
        └── ...
```

## 🚀 Setup Instructions

### Step 1: Enable GitHub Pages

1. Go to your GitHub repository settings
2. Navigate to **Pages** section
3. Under **Source**, select:
   - Source: **GitHub Actions**
4. Save

### Step 2: Add Workflow File

The workflow file has been created at `.github/workflows/deploy-docs.yml`

It will automatically:
- ✅ Build mdBook documentation
- ✅ Generate Rust API docs
- ✅ Copy all documentation files
- ✅ Create a documentation hub
- ✅ Deploy to GitHub Pages

### Step 3: Trigger Deployment

**Option 1: Automatic (on push)**
```bash
git add .
git commit -m "docs: Setup GitHub Pages deployment"
git push origin main
```

**Option 2: Manual (via GitHub Actions)**
1. Go to **Actions** tab
2. Select **Deploy Documentation to GitHub Pages**
3. Click **Run workflow**
4. Select **main** branch
5. Click **Run workflow**

### Step 4: Verify Deployment

After the workflow completes (2-5 minutes):
1. Go to **Settings → Pages**
2. You'll see: "Your site is live at `https://litmajor.github.io/mtaa-dao/`"
3. Visit the URL to see your documentation hub

## 🎨 Documentation URLs

Once deployed, documentation will be available at:

| Documentation | URL |
|--------------|-----|
| **Hub** | `https://litmajor.github.io/mtaa-dao/` |
| **Whitepaper** | `https://litmajor.github.io/mtaa-dao/whitepaper/` |
| **Progress** | `https://litmajor.github.io/mtaa-dao/progress.html` |
| **Technical Guide** | `https://litmajor.github.io/mtaa-dao/book/` |
| **Rust API Docs** | `https://litmajor.github.io/mtaa-dao/rust-docs/mtaa_dao/` |

## 🔄 Auto-Update Process

The documentation will automatically rebuild and redeploy when:
1. ✅ Any file in `mtaa-dao-whitepaper/` changes
2. ✅ `client/public/whitepaper.html` is updated
3. ✅ `PROGRESS.html` is modified
4. ✅ Workflow file is changed

## 🛠️ Local Testing

### Test mdBook locally:
```bash
cd mtaa-dao-whitepaper
mdbook serve --open
```
Visit: `http://localhost:3000`

### Test Rust docs locally:
```bash
cd mtaa-dao-whitepaper
cargo doc --open --no-deps
```

### Test HTML files:
```bash
# Open in browser
start client/public/whitepaper.html
start PROGRESS.html
```

## 📝 Maintenance

### Update Whitepaper
1. Edit `client/public/whitepaper.html`
2. Commit and push
3. Auto-deploys in ~3 minutes

### Update Progress Tracker
1. Edit `PROGRESS.html`
2. Commit and push
3. Auto-deploys in ~3 minutes

### Update Technical Docs
1. Edit files in `mtaa-dao-whitepaper/src/`
2. Commit and push
3. Auto-builds and deploys

### Update Rust Docs
1. Update Rust code and doc comments in `mtaa-dao-whitepaper/src/lib.rs`
2. Commit and push
3. Auto-generates and deploys

## 🎯 Custom Domain (Optional)

To use a custom domain (e.g., `docs.mtaadao.org`):

1. Create `docs-output/CNAME` file:
```bash
echo "docs.mtaadao.org" > CNAME
```

2. Add CNAME to workflow (in `.github/workflows/deploy-docs.yml`):
```yaml
- name: Create CNAME
  run: echo "docs.mtaadao.org" > ./docs-output/CNAME
```

3. Configure DNS:
   - Type: `CNAME`
   - Name: `docs`
   - Value: `litmajor.github.io`

4. Enable in GitHub Settings → Pages → Custom domain

## 🔍 Troubleshooting

### Build Fails

**Check mdBook installation:**
```bash
mdbook --version
```

**Check Rust installation:**
```bash
rustc --version
cargo --version
```

### Pages Not Updating

1. Check **Actions** tab for errors
2. Verify **Pages** settings use "GitHub Actions"
3. Wait 5-10 minutes for propagation
4. Clear browser cache (Ctrl+Shift+R)

### 404 Errors

1. Ensure file paths are correct in workflow
2. Check that `docs-output` directory structure is correct
3. Verify artifact upload includes all files

## 📊 Workflow Status

You can add a badge to your README:

```markdown
[![Deploy Docs](https://github.com/litmajor/mtaa-dao/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/litmajor/mtaa-dao/actions/workflows/deploy-docs.yml)
```

## ✅ Deployment Checklist

Before first deployment:
- [ ] GitHub Pages enabled in repository settings
- [ ] Workflow file committed (`.github/workflows/deploy-docs.yml`)
- [ ] mdBook files up to date
- [ ] HTML whitepaper finalized
- [ ] Progress tracker updated
- [ ] Push to main branch
- [ ] Monitor Actions tab for build status
- [ ] Verify site is live (wait 5-10 minutes)
- [ ] Test all documentation links
- [ ] Share URL with team!

## 🎉 Post-Deployment

Once deployed, you can:
1. ✅ Share documentation with community
2. ✅ Link from main README
3. ✅ Include in whitepaper/pitch decks
4. ✅ Use for developer onboarding
5. ✅ Reference in grant applications

## 🔗 Integration

Add to your main `README.md`:

```markdown
## 📚 Documentation

- **[Complete Documentation Hub](https://litmajor.github.io/mtaa-dao/)** - All docs in one place
- **[Whitepaper](https://litmajor.github.io/mtaa-dao/whitepaper/)** - Platform overview
- **[Progress Tracker](https://litmajor.github.io/mtaa-dao/progress.html)** - Development status
- **[Technical Guide](https://litmajor.github.io/mtaa-dao/book/)** - Deep dive
- **[API Reference](https://litmajor.github.io/mtaa-dao/rust-docs/mtaa_dao/)** - Rust docs
```

---

## 🚀 Ready to Deploy?

Run these commands:

```bash
# Ensure all changes are committed
git add .
git commit -m "docs: Add GitHub Pages deployment with comprehensive documentation"
git push origin main
```

Then visit the **Actions** tab to watch the magic happen! ✨

Your documentation will be live at:
**https://litmajor.github.io/mtaa-dao/**

---

_Happy documenting! 🎉_

