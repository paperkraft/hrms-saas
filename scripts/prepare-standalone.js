const fs = require('fs');
const path = require('path');

async function buildStandalone() {
  const rootDir = process.cwd();
  const standaloneDir = path.join(rootDir, '.next', 'standalone');
  const staticDir = path.join(rootDir, '.next', 'static');
  const publicDir = path.join(rootDir, 'public');
  const scriptsDir = path.join(rootDir, 'scripts');
  
  // Destination folder for manual deployment
  const outDir = path.join(rootDir, 'hrms-standalone-build');

  console.log('🚀 Preparing standalone build folder...');

  try {
    // Clean old output directory if it exists
    if (fs.existsSync(outDir)) {
      console.log('🗑️ Cleaning old standalone build folder...');
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    // 1. Copy Next.js Standalone Output to outDir
    // This will bring the optimized server.js, package.json, and node_modules
    if (fs.existsSync(standaloneDir)) {
      console.log(`📦 Copying /.next/standalone to /hrms-standalone-build...`);
      fs.cpSync(standaloneDir, outDir, { recursive: true });
    } else {
      console.error('❌ Standalone output not found! Did you run "npm run build" first?');
      process.exit(1);
    }

    // 2. Copy public folder
    if (fs.existsSync(publicDir)) {
      console.log('📦 Copying /public...');
      fs.cpSync(publicDir, path.join(outDir, 'public'), { recursive: true });
    }

    // 3. Copy static folder
    if (fs.existsSync(staticDir)) {
      console.log('📦 Copying /.next/static...');
      fs.cpSync(staticDir, path.join(outDir, '.next', 'static'), { recursive: true });
    }

    // 4. Copy scripts folder
    if (fs.existsSync(scriptsDir)) {
      console.log('📦 Copying /scripts...');
      fs.cpSync(scriptsDir, path.join(outDir, 'scripts'), { recursive: true });
    }

    // 5. Prune unnecessary bloated files from standalone node_modules
    const standaloneNodeModules = path.join(outDir, 'node_modules');
    if (fs.existsSync(standaloneNodeModules)) {
      console.log('🧹 Pruning standalone node_modules to reduce size...');
      
      const toRemove = [
        path.join(standaloneNodeModules, '@swc', 'core'),
        path.join(standaloneNodeModules, '.cache'),
        path.join(standaloneNodeModules, 'typescript'),
        path.join(standaloneNodeModules, 'eslint'),
        path.join(standaloneNodeModules, 'prettier'),
        path.join(standaloneNodeModules, 'prisma'),
        path.join(standaloneNodeModules, '@types'),
      ];

      toRemove.forEach(dir => {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`  🗑️ Removed ${path.basename(dir)}`);
        }
      });

      // Prisma engines pruning - keep only windows engine if deploying to IIS, but to be safe, keep only what's strictly necessary
      const prismaEnginesDir = path.join(standaloneNodeModules, '@prisma', 'engines');
      const prismaClientDir = path.join(standaloneNodeModules, '.prisma', 'client');
      
      [prismaEnginesDir, prismaClientDir].forEach(dir => {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          files.forEach(file => {
             // If we deploy on Windows, we usually need query_engine-windows.dll.node
             // Let's remove debian, darwin, and other unneeded engines to save ~100MB
             if (file.includes('query_engine') && !file.includes('windows') && !file.includes('debian-openssl')) {
                fs.rmSync(path.join(dir, file), { force: true });
                console.log(`  🗑️ Removed unused engine ${file}`);
             }
          });
        }
      });
    }

    // 6. Copy config files
    const configFiles = ['cron.config.js', 'ecosystem.config.js'];
    for (const file of configFiles) {
      const source = path.join(rootDir, file);
      if (fs.existsSync(source)) {
        console.log(`📦 Copying ${file}...`);
        fs.copyFileSync(source, path.join(outDir, file));
      }
    }

    // 7. Update default port in server.js to 5000
    const serverJsPath = path.join(outDir, 'server.js');
    if (fs.existsSync(serverJsPath)) {
      console.log('🔧 Setting default port to 5000 in server.js...');
      let serverContent = fs.readFileSync(serverJsPath, 'utf8');
      serverContent = serverContent.replace(
        /const currentPort = parseInt\(process\.env\.PORT,\s*10\)\s*\|\|\s*\d+/g,
        'const currentPort = parseInt(process.env.PORT, 10) || 5000'
      );
      fs.writeFileSync(serverJsPath, serverContent, 'utf8');
      console.log('✅ Port 5000 configured as default in server.js');
    }

    console.log('✅ Standalone build is fully assembled and ready in: ' + outDir);
    console.log('💡 You can now ZIP this folder or manually copy it to your production server.');
  } catch (err) {
    console.error('❌ Error preparing standalone build:', err);
    process.exit(1);
  }
}

buildStandalone();
