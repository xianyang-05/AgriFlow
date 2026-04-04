import { NextResponse } from "next/server"
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib"
import fs from "fs"
import path from "path"

type FormPayload = {
  fullName?: string
  icNumber?: string
  contact?: string
  farmArea?: string
  location?: string
  signatureDataUrl?: string
}

function fitTextToWidth(
  text: string,
  maxWidth: number,
  font: PDFFont,
  initialSize: number,
  minSize = 8
) {
  let size = initialSize

  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5
  }

  return size
}

function drawBoundedText({
  page,
  text,
  x,
  y,
  maxWidth,
  font,
  defaultSize = 10,
}: {
  page: PDFPage
  text: string
  x: number
  y: number
  maxWidth: number
  font: PDFFont
  defaultSize?: number
}) {
  const trimmedText = text.trim()
  if (!trimmedText) return

  const size = fitTextToWidth(trimmedText, maxWidth, font, defaultSize)

  page.drawText(trimmedText, {
    x,
    y,
    size,
    maxWidth,
    font,
    color: rgb(0, 0, 0),
  })
}

function formatCurrentDate() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date())
}

async function buildPdf(formData: FormPayload) {
  const templatePath = path.join(process.cwd(), "public", "Borang-Cadangan-v13092024.pdf")
  const pdfBytes = fs.readFileSync(templatePath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const secondPage = pages[1]

  const firstPageX = 240
  const firstPageWidth = 360
  const firstPageBase = 792

  if (formData.fullName) {
    drawBoundedText({
      page: firstPage,
      text: formData.fullName,
      x: firstPageX,
      y: firstPageBase - 389,
      maxWidth: firstPageWidth,
      font,
    })
  }

  if (formData.icNumber) {
    drawBoundedText({
      page: firstPage,
      text: formData.icNumber,
      x: firstPageX,
      y: firstPageBase - 406,
      maxWidth: firstPageWidth,
      font,
    })
  }

  if (formData.contact) {
    drawBoundedText({
      page: firstPage,
      text: formData.contact,
      x: firstPageX,
      y: firstPageBase - 424,
      maxWidth: firstPageWidth,
      font,
    })
  }

  if (formData.location) {
    drawBoundedText({
      page: firstPage,
      text: formData.location,
      x: firstPageX,
      y: firstPageBase - 442,
      maxWidth: firstPageWidth,
      font,
    })
  }

  const currentDate = formatCurrentDate()

  drawBoundedText({
    page: secondPage,
    text: formData.fullName || "",
    x: 445,
    y: 343,
    maxWidth: 92,
    font,
    defaultSize: 7,
  })

  drawBoundedText({
    page: secondPage,
    text: formData.icNumber || "",
    x: 445,
    y: 334.5,
    maxWidth: 92,
    font,
    defaultSize: 7,
  })

  drawBoundedText({
    page: secondPage,
    text: currentDate,
    x: 445,
    y: 326,
    maxWidth: 92,
    font,
    defaultSize: 7,
  })

  if (formData.signatureDataUrl) {
    const base64 = formData.signatureDataUrl.split(",")[1]
    if (base64) {
      const imageBytes = Buffer.from(base64, "base64")
      const signatureImage = formData.signatureDataUrl.includes("image/jpeg")
        ? await pdfDoc.embedJpg(imageBytes)
        : await pdfDoc.embedPng(imageBytes)

      const imageDims = signatureImage.scale(1)
      const maxWidth = 116
      const maxHeight = 40
      const scale = Math.min(maxWidth / imageDims.width, maxHeight / imageDims.height)
      const width = imageDims.width * scale
      const height = imageDims.height * scale

      secondPage.drawImage(signatureImage, {
        x: 392 + (maxWidth - width) / 2,
        y: 349 + (maxHeight - height) / 2,
        width,
        height,
      })
    }
  }

  return pdfDoc.save()
}

function makeFileName(fullName: string) {
  return `STTP_Form_${(fullName || "User").replace(/\s+/g, "_")}.pdf`
}

async function saveAndRespond(formData: FormPayload) {
  const modifiedPdfBytes = await buildPdf(formData)
  const downloadDir = path.join(process.cwd(), "public", "downloads")

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true })
  }

  const fileName = makeFileName(formData.fullName || "User")
  const filePath = path.join(downloadDir, fileName)
  fs.writeFileSync(filePath, Buffer.from(modifiedPdfBytes))

  return NextResponse.json({
    success: true,
    downloadUrl: `/downloads/${fileName}`,
    fileName,
  })
}

export async function POST(req: Request) {
  try {
    const formData = (await req.json()) as FormPayload
    return await saveAndRespond(formData)
  } catch (error) {
    console.error("PDF Generation Error:", error)
    return NextResponse.json({ success: false, error: "Failed to generate PDF" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const formData: FormPayload = {
      fullName: searchParams.get("fullName") || "",
      icNumber: searchParams.get("icNumber") || "",
      contact: searchParams.get("contact") || "",
      farmArea: searchParams.get("farmArea") || "",
      location: searchParams.get("location") || "",
    }

    return await saveAndRespond(formData)
  } catch (error) {
    console.error("PDF Generation Error:", error)
    return NextResponse.json({ success: false, error: "Failed to generate PDF" }, { status: 500 })
  }
}
