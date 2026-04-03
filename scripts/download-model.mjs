/**
 * Download script: fetches the YOLOv8 plant disease ONNX model from HuggingFace
 * and saves it to public/models/yolov8-plant.onnx
 *
 * Run with: node scripts/download-model.mjs
 */
import { createWriteStream, existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { get } from 'https'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUTPUT_DIR = join(ROOT, 'public', 'models')
const OUTPUT_FILE = join(OUTPUT_DIR, 'yolov8-plant.onnx')

// Model sources to try in order
const MODEL_SOURCES = [
  {
    name: 'HuggingFace – foduucom plant disease YOLOv8',
    url: 'https://huggingface.co/foduucom/plant-disease-detection-using-yolov8/resolve/main/best.onnx',
  },
]

function downloadFile(url, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) {
      reject(new Error('Too many redirects'))
      return
    }
    const file = createWriteStream(destPath)
    let totalBytes = 0
    let downloaded = 0
    let lastPercent = -1

    get(url, { headers: { 'User-Agent': 'AgriFlow-ModelDownloader/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        file.close()
        const redirectUrl = res.headers.location
        console.log(`  ↪  Redirecting to ${redirectUrl}`)
        downloadFile(redirectUrl, destPath, redirectCount + 1).then(resolve).catch(reject)
        return
      }

      if (res.statusCode !== 200) {
        file.close()
        reject(new Error(`HTTP ${res.statusCode} from ${url}`))
        return
      }

      totalBytes = parseInt(res.headers['content-length'] || '0', 10)
      res.pipe(file)

      res.on('data', (chunk) => {
        downloaded += chunk.length
        if (totalBytes > 0) {
          const pct = Math.floor((downloaded / totalBytes) * 100)
          if (pct !== lastPercent && pct % 10 === 0) {
            process.stdout.write(`  ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)\r`)
            lastPercent = pct
          }
        }
      })

      file.on('finish', () => {
        file.close()
        console.log(`\n  ✓ Downloaded ${(downloaded / 1024 / 1024).toFixed(2)} MB`)
        resolve()
      })

      res.on('error', (err) => {
        file.close()
        reject(err)
      })
    }).on('error', (err) => {
      file.close()
      reject(err)
    })
  })
}

async function main() {
  console.log('🌱 AgriFlow — YOLO Plant Disease Model Downloader\n')

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true })

  if (existsSync(OUTPUT_FILE)) {
    const sizeKB = (await import('fs')).statSync(OUTPUT_FILE).size / 1024
    if (sizeKB > 100) {
      console.log(`✅  Model already exists at public/models/yolov8-plant.onnx (${(sizeKB / 1024).toFixed(1)} MB)`)
      console.log('   Delete the file and re-run to re-download.\n')
      return
    }
    console.log('⚠️  Existing file is too small (<100 KB), re-downloading...\n')
  }

  for (const source of MODEL_SOURCES) {
    console.log(`📥  Trying: ${source.name}`)
    console.log(`    URL: ${source.url}\n`)
    try {
      await downloadFile(source.url, OUTPUT_FILE)
      console.log(`\n✅  Model saved to: public/models/yolov8-plant.onnx`)
      console.log('\n🚀  You can now run: npm run dev\n')
      return
    } catch (err) {
      console.error(`\n❌  Failed: ${err.message}\n`)
    }
  }

  console.error('❌  All sources failed. Please manually download a YOLOv8 plant disease ONNX model')
  console.error('   and save it as: public/models/yolov8-plant.onnx\n')
  console.error('   Recommended model (38-class PlantVillage):')
  console.error('   https://huggingface.co/foduucom/plant-disease-detection-using-yolov8\n')
  process.exit(1)
}

main().catch(console.error)
