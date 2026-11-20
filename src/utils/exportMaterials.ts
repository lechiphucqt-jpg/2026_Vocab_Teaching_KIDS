import type { BrandSettings, LessonDeck, VocabCard } from '../types/edtech';

// -------------------------------------------------------------
// PURE TYPESCRIPT ZIP BUILDER (ZERO EXTERNAL DEPENDENCIES)
// -------------------------------------------------------------
class SimpleZip {
  private files: { name: string; data: Uint8Array }[] = [];

  addFile(name: string, content: string | Uint8Array) {
    let data: Uint8Array;
    if (typeof content === 'string') {
      data = new TextEncoder().encode(content);
    } else {
      data = content;
    }
    this.files.push({ name, data });
  }

  generateBlob(mimeType = 'application/zip'): Blob {
    let totalSize = 0;
    const localHeaders: { offset: number; size: number; header: Uint8Array; file: typeof this.files[0] }[] = [];

    // 1. Calculate offsets and write local file headers
    for (const f of this.files) {
      const nameBytes = new TextEncoder().encode(f.name);
      const dataBytes = f.data;
      const crc = this.computeCrc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(localHeader.buffer);

      dv.setUint32(0, 0x04034b50, true); // Local file header signature
      dv.setUint16(4, 20, true); // Version needed (2.0)
      dv.setUint16(6, 0, true); // General purpose flags
      dv.setUint16(8, 0, true); // Compression method (0 = uncompressed store)
      dv.setUint16(10, 0, true); // Mod time
      dv.setUint16(12, 0, true); // Mod date
      dv.setUint32(14, crc, true); // CRC-32
      dv.setUint32(18, dataBytes.length, true); // Compressed size
      dv.setUint32(22, dataBytes.length, true); // Uncompressed size
      dv.setUint16(26, nameBytes.length, true); // Filename length
      dv.setUint16(28, 0, true); // Extra field length
      localHeader.set(nameBytes, 30);

      localHeaders.push({
        offset: totalSize,
        size: localHeader.length + dataBytes.length,
        header: localHeader,
        file: f,
      });

      totalSize += localHeader.length + dataBytes.length;
    }

    const centralDirOffset = totalSize;
    let centralDirSize = 0;
    const centralHeaders: Uint8Array[] = [];

    // 2. Write Central Directory Headers
    for (const item of localHeaders) {
      const nameBytes = new TextEncoder().encode(item.file.name);
      const crc = this.computeCrc32(item.file.data);
      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const dv = new DataView(cdHeader.buffer);

      dv.setUint32(0, 0x02014b50, true); // Central directory file header signature
      dv.setUint16(4, 20, true); // Version made by
      dv.setUint16(6, 20, true); // Version needed to extract
      dv.setUint16(8, 0, true); // General purpose flag
      dv.setUint16(10, 0, true); // Compression method (0 = store)
      dv.setUint16(12, 0, true); // Mod time
      dv.setUint16(14, 0, true); // Mod date
      dv.setUint32(16, crc, true); // CRC-32
      dv.setUint32(20, item.file.data.length, true); // Compressed size
      dv.setUint32(24, item.file.data.length, true); // Uncompressed size
      dv.setUint16(28, nameBytes.length, true); // File name length
      dv.setUint16(30, 0, true); // Extra field length
      dv.setUint16(32, 0, true); // File comment length
      dv.setUint16(34, 0, true); // Disk number start
      dv.setUint16(36, 0, true); // Internal file attributes
      dv.setUint32(38, 0, true); // External file attributes
      dv.setUint32(42, item.offset, true); // Relative offset of local header
      cdHeader.set(nameBytes, 46);

      centralHeaders.push(cdHeader);
      centralDirSize += cdHeader.length;
    }

    // 3. End of Central Directory Record
    const eocd = new Uint8Array(22);
    const eocdDv = new DataView(eocd.buffer);
    eocdDv.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdDv.setUint16(4, 0, true); // Number of this disk
    eocdDv.setUint16(6, 0, true); // Disk where central directory starts
    eocdDv.setUint16(8, this.files.length, true); // Number of central directory records on this disk
    eocdDv.setUint16(10, this.files.length, true); // Total number of central directory records
    eocdDv.setUint32(12, centralDirSize, true); // Size of central directory
    eocdDv.setUint32(16, centralDirOffset, true); // Offset of start of central directory
    eocdDv.setUint16(20, 0, true); // Comment length

    // Assemble parts
    const parts: Uint8Array[] = [];
    for (const item of localHeaders) {
      parts.push(item.header);
      parts.push(item.file.data);
    }
    for (const cd of centralHeaders) {
      parts.push(cd);
    }
    parts.push(eocd);

    return new Blob(parts as unknown as BlobPart[], { type: mimeType });
  }

  private computeCrc32(data: Uint8Array): number {
    let crc = ~0;
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ SimpleZip.crcTable[(crc ^ data[i]) & 0xff];
    }
    return ~crc >>> 0;
  }

  private static crcTable: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    return table;
  })();
}

// -------------------------------------------------------------
// PPTX GENERATOR (COMPATIBLE WITH POWERPOINT & GOOGLE SLIDES)
// -------------------------------------------------------------
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generatePowerPointPresentation(
  deck: LessonDeck,
  cards: VocabCard[],
  brandSettings: BrandSettings
): Blob {
  const zip = new SimpleZip();

  // 1. [Content_Types].xml
  let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;

  for (let i = 0; i < cards.length; i++) {
    contentTypes += `\n  <Override PartName="/ppt/slides/slide${i + 2}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }
  contentTypes += `\n</Types>`;
  zip.addFile('[Content_Types].xml', contentTypes);

  // 2. _rels/.rels
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
  zip.addFile('_rels/.rels', rootRels);

  // 3. ppt/presentation.xml
  let presSlidesList = `<p:sldId id="256" r:id="rId2"/>`;
  for (let i = 0; i < cards.length; i++) {
    presSlidesList += `\n    <p:sldId id="${257 + i}" r:id="rId${i + 3}"/>`;
  }

  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${presSlidesList}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
  zip.addFile('ppt/presentation.xml', presentationXml);

  // 4. ppt/_rels/presentation.xml.rels
  let presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>`;
  for (let i = 0; i < cards.length; i++) {
    presRels += `\n  <Relationship Id="rId${i + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 2}.xml"/>`;
  }
  presRels += `\n</Relationships>`;
  zip.addFile('ppt/_rels/presentation.xml.rels', presRels);

  // 5. Minimal Slide Master, Layout, and Theme
  const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
  <p:txStyles/>
</p:sldMaster>`;
  zip.addFile('ppt/slideMasters/slideMaster1.xml', slideMasterXml);

  const masterRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
  zip.addFile('ppt/slideMasters/_rels/slideMaster1.xml.rels', masterRels);

  const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;
  zip.addFile('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml);

  const layoutRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
  zip.addFile('ppt/slideLayouts/_rels/slideLayout1.xml.rels', layoutRels);

  const themeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Tieng Anh Thay Phuc Theme">
  <a:themeElements>
    <a:clrScheme name="Custom">
      <a:dk1><a:srgbClr val="0F172A"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="334155"/></a:dk2>
      <a:lt2><a:srgbClr val="F1F5F9"/></a:lt2>
      <a:accent1><a:srgbClr val="0284C7"/></a:accent1>
      <a:accent2><a:srgbClr val="10B981"/></a:accent2>
      <a:accent3><a:srgbClr val="F59E0B"/></a:accent3>
      <a:accent4><a:srgbClr val="EF4444"/></a:accent4>
      <a:accent5><a:srgbClr val="8B5CF6"/></a:accent5>
      <a:accent6><a:srgbClr val="06B6D4"/></a:accent6>
      <a:hlink><a:srgbClr val="0284C7"/></a:hlink>
      <a:folHlink><a:srgbClr val="0369A1"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Modern">
      <a:majorFont><a:latin typeface="Arial"/></a:majorFont>
      <a:minorFont><a:latin typeface="Arial"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>
  </a:themeElements>
</a:theme>`;
  zip.addFile('ppt/theme/theme1.xml', themeXml);

  // 6. Slide 1: Title Slide
  const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      <!-- Brand & Classroom Subtitle -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Brand"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="914400"/><a:ext cx="7315200" cy="600000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="vi-VN" sz="2000" b="1">
                <a:solidFill><a:srgbClr val="0284C7"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(brandSettings.brandTitle.toUpperCase())} · ${escapeXml(brandSettings.classroomSubtitle)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Main Lesson Title -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="1700000"/><a:ext cx="7315200" cy="1800000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="vi-VN" sz="4400" b="1">
                <a:solidFill><a:srgbClr val="0F172A"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(deck.title)}</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="vi-VN" sz="2400">
                <a:solidFill><a:srgbClr val="64748B"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(deck.subtitle)} · ${escapeXml(deck.level)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Badge / Total Words -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Badge"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="2743200" y="3800000"/><a:ext cx="3657600" cy="600000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="E0F2FE"/></a:solidFill>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="vi-VN" sz="1800" b="1">
                <a:solidFill><a:srgbClr val="0369A1"/></a:solidFill>
              </a:rPr>
              <a:t>Khám phá ${cards.length} từ vựng mới cùng hình ảnh và phát âm</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
  zip.addFile('ppt/slides/slide1.xml', slide1Xml);

  const slideCommonRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
  zip.addFile('ppt/slides/_rels/slide1.xml.rels', slideCommonRels);

  // 7. Vocabulary Cards Slides (Slide 2 to N+1)
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const slideNumber = i + 2;

    const vocabSlideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>

      <!-- Header Mini Bar -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="TopBar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="300000"/><a:ext cx="8229600" cy="400000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:rPr lang="vi-VN" sz="1300" b="1">
                <a:solidFill><a:srgbClr val="0284C7"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(brandSettings.brandTitle)} · ${escapeXml(deck.title)} (Từ ${i + 1}/${cards.length})</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Big English Word Card Box -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="WordCard"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="900000"/><a:ext cx="8229600" cy="3600000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
          <a:ln w="25400"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr vert="horz" anchor="ctr"/>
          
          <!-- English Word in Huge Type -->
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="5400" b="1">
                <a:solidFill><a:srgbClr val="0F172A"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(card.word)}</a:t>
            </a:r>
          </a:p>

          <!-- Syllables & Phonetic -->
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="2600" i="1">
                <a:solidFill><a:srgbClr val="0284C7"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(card.phonetic)}${card.syllables ? `  •  [${escapeXml(card.syllables)}]` : ''}</a:t>
            </a:r>
          </a:p>

          <!-- Divider Space -->
          <a:p><a:pPr algn="ctr"/></a:p>

          <!-- Meaning -->
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="vi-VN" sz="2800" b="1">
                <a:solidFill><a:srgbClr val="10B981"/></a:solidFill>
              </a:rPr>
              <a:t>“${escapeXml(card.meaning)}”</a:t>
            </a:r>
          </a:p>

          <!-- Example Sentence -->
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="2200">
                <a:solidFill><a:srgbClr val="475569"/></a:solidFill>
              </a:rPr>
              <a:t>Example: ${escapeXml(card.example)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Bottom Hint for Teacher -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="TeacherHint"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="4650000"/><a:ext cx="8229600" cy="300000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="vi-VN" sz="1200">
                <a:solidFill><a:srgbClr val="94A3B8"/></a:solidFill>
              </a:rPr>
              <a:t>💡 Hướng dẫn: Thầy/Cô cho học sinh đồng thanh đọc từ 3 lần, sau đó gọi 2 đội thi phát âm tính điểm.</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    zip.addFile(`ppt/slides/slide${slideNumber}.xml`, vocabSlideXml);
    zip.addFile(`ppt/slides/_rels/slide${slideNumber}.xml.rels`, slideCommonRels);
  }

  return zip.generateBlob('application/vnd.openxmlformats-officedocument.presentationml.presentation');
}

// -------------------------------------------------------------
// MOODLE XML QUESTION BANK EXPORTER
// -------------------------------------------------------------
export function generateMoodleXml(deck: LessonDeck, cards: VocabCard[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <!-- Category -->
  <question type="category">
    <category>
      <text>$course$/Tiếng Anh Thầy Phúc/${escapeXml(deck.title)}</text>
    </category>
    <info format="html">
      <text>Bộ câu hỏi từ vựng ${escapeXml(deck.title)} - ${escapeXml(deck.level)}</text>
    </info>
  </question>

  <!-- 1. Matching Question for all words -->
  <question type="matching">
    <name><text>Nối từ vựng: ${escapeXml(deck.title)}</text></name>
    <questiontext format="html">
      <text><![CDATA[<p><strong>Bé hãy nối các từ vựng tiếng Anh sau đây với nghĩa tiếng Việt thích hợp:</strong></p>]]></text>
    </questiontext>
    <generalfeedback format="html"><text><![CDATA[<p>Rất tốt! Bé đã hoàn thành bài nối từ vựng.</p>]]></text></generalfeedback>
    <defaultgrade>${cards.length}</defaultgrade>
    <penalty>0.2</penalty>
    <hidden>0</hidden>
    <shuffleanswers>true</shuffleanswers>`;

  for (const card of cards) {
    xml += `
    <subquestion format="html">
      <text><![CDATA[<p><strong>${escapeXml(card.word)}</strong> <small>(${escapeXml(card.phonetic)})</small></p>]]></text>
      <answer><text>${escapeXml(card.meaning)}</text></answer>
    </subquestion>`;
  }

  xml += `
  </question>`;

  // 2. Individual Multiple Choice questions for each card
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    // Gather 3 distractors from other cards in the deck
    const otherCards = cards.filter((_, idx) => idx !== i);
    const distractors = otherCards.slice(0, 3);

    xml += `
  <!-- Multiple Choice: ${escapeXml(card.word)} -->
  <question type="multichoice">
    <name><text>Chọn từ đúng: ${escapeXml(card.word)}</text></name>
    <questiontext format="html">
      <text><![CDATA[<p>Từ nào sau đây mang nghĩa là: <strong>“${escapeXml(card.meaning)}”</strong>?</p><p><em>Ví dụ: ${escapeXml(card.example)}</em></p>]]></text>
    </questiontext>
    <defaultgrade>1</defaultgrade>
    <single>true</single>
    <shuffleanswers>true</shuffleanswers>
    <answernumbering>abc</answernumbering>
    <answer fraction="100" format="html">
      <text><![CDATA[<strong>${escapeXml(card.word)}</strong> <small>(${escapeXml(card.phonetic)})</small>]]></text>
      <feedback format="html"><text><![CDATA[<p>Chính xác! Bé thật giỏi.</p>]]></text></feedback>
    </answer>`;

    for (const d of distractors) {
      xml += `
    <answer fraction="0" format="html">
      <text><![CDATA[${escapeXml(d.word)} <small>(${escapeXml(d.phonetic)})</small>]]></text>
      <feedback format="html"><text><![CDATA[<p>Chưa đúng rồi, thử lại nhé!</p>]]></text></feedback>
    </answer>`;
    }

    xml += `
  </question>`;
  }

  xml += `\n</quiz>`;
  return xml;
}

// -------------------------------------------------------------
// PRINTABLE WORKSHEET & FLASHCARD HTML BUILDER
// -------------------------------------------------------------
export function generateWorksheetHtml(deck: LessonDeck, cards: VocabCard[], brandSettings: BrandSettings): string {
  const shuffledCards = [...cards].sort(() => 0.5 - Math.random());
  const shuffledMeanings = [...cards].map((c) => c.meaning).sort(() => 0.5 - Math.random());

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <title>Phiếu Bài Tập — ${escapeXml(deck.title)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; padding: 10px; }
    .header { border-bottom: 2px dashed #0284c7; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title-area h1 { margin: 0; font-size: 20px; color: #0f172a; }
    .title-area p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
    .student-info { font-size: 13px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 14px; background: #f8fafc; }
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .section-title { font-size: 14px; font-weight: bold; background: #e0f2fe; color: #0369a1; padding: 5px 10px; border-radius: 6px; margin-bottom: 10px; }
    .matching-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 40px; }
    .matching-item { display: flex; align-items: center; justify-content: space-between; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; font-size: 14px; background: #ffffff; }
    .circle-node { width: 14px; height: 14px; border: 2px solid #0284c7; border-radius: 50%; display: inline-block; }
    .cloze-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .cloze-item { border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; font-size: 13px; }
    .answer-key { margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 11px; color: #64748b; page-break-inside: avoid; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h1>${escapeXml(brandSettings.brandTitle)}</h1>
      <p>Chủ đề: <strong>${escapeXml(deck.title)}</strong> · ${escapeXml(deck.level)}</p>
    </div>
    <div class="student-info">
      <div>Họ và tên: ...........................................................</div>
      <div style="margin-top: 4px;">Lớp: ........................ Ngày: ...... / ...... / 202...</div>
      <div style="margin-top: 4px; font-weight: bold; color: #0284c7;">Điểm số: ......... / 10 ★</div>
    </div>
  </div>

  <!-- Phần 1: Nối từ -->
  <div class="section">
    <div class="section-title">PHẦN 1: NỐI TỪ VỰNG TIẾNG ANH VỚI NGHĨA TIẾNG VIỆT (Matching)</div>
    <div class="matching-grid">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${shuffledCards
          .map(
            (c, i) => `
          <div class="matching-item">
            <span><strong>${i + 1}. ${escapeXml(c.word)}</strong> <small style="color: #64748b;">${escapeXml(c.phonetic)}</small></span>
            <span class="circle-node"></span>
          </div>`
          )
          .join('')}
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${shuffledMeanings
          .map(
            (m, i) => `
          <div class="matching-item">
            <span class="circle-node"></span>
            <span><strong>${String.fromCharCode(65 + i)}.</strong> ${escapeXml(m)}</span>
          </div>`
          )
          .join('')}
      </div>
    </div>
  </div>

  <!-- Phần 2: Điền chữ cái còn thiếu -->
  <div class="section">
    <div class="section-title">PHẦN 2: ĐIỀN CHỮ CÁI CÒN THIẾU VÀO Ô TRỐNG (Fill in the blanks)</div>
    <div class="cloze-grid">
      ${cards
        .map((c, i) => {
          // Mask some characters
          const masked = c.word
            .split('')
            .map((ch, idx) => (idx % 2 === 1 ? ' ___ ' : ch))
            .join('');
          return `
        <div class="cloze-item">
          <strong>${i + 1}.</strong> Gợi ý: “${escapeXml(c.meaning)}”<br/>
          <span style="font-size: 15px; font-weight: bold; letter-spacing: 2px; color: #0284c7;">${escapeXml(masked)}</span>
        </div>`;
        })
        .join('')}
    </div>
  </div>

  <!-- Phần 3: Luyện viết câu -->
  <div class="section">
    <div class="section-title">PHẦN 3: ĐỌC VÀ VIẾT LẠI CÂU VÍ DỤ (Writing Practice)</div>
    ${cards
      .slice(0, 3)
      .map(
        (c, i) => `
      <div style="margin-bottom: 12px; font-size: 13px;">
        <strong>${i + 1}. ${escapeXml(c.word)}</strong>: “${escapeXml(c.example)}”<br/>
        <div style="border-bottom: 1px dotted #94a3b8; height: 24px; margin-top: 4px;"></div>
      </div>`
      )
      .join('')}
  </div>

  <!-- Trang đáp án giáo viên -->
  <div class="answer-key">
    <strong>BẢNG ĐÁP ÁN (Dành cho Giáo viên & Phụ huynh chấm bài):</strong><br/>
    ${cards.map((c) => `${escapeXml(c.word)} = ${escapeXml(c.meaning)}`).join('  •  ')}
  </div>
</body>
</html>`;
}

export function generatePrintableFlashcardsHtml(deck: LessonDeck, cards: VocabCard[], brandSettings: BrandSettings): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <title>Bộ Thẻ In Flashcards — ${escapeXml(deck.title)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; margin: 0; padding: 10px; }
    .flashcards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .flashcard {
      border: 2px dashed #94a3b8;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      background: #ffffff;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      position: relative;
    }
    .scissors {
      position: absolute;
      top: -10px;
      right: 12px;
      background: white;
      padding: 0 4px;
      font-size: 12px;
      color: #94a3b8;
    }
    .card-word {
      font-size: 28px;
      font-weight: bold;
      color: #0f172a;
      margin: 8px 0 2px;
    }
    .card-phonetic {
      font-size: 14px;
      color: #0284c7;
      font-style: italic;
      margin-bottom: 8px;
    }
    .card-meaning {
      font-size: 16px;
      font-weight: 600;
      color: #10b981;
      margin-bottom: 4px;
    }
    .card-example {
      font-size: 12px;
      color: #64748b;
    }
    .brand-tag {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
    <h2 style="margin: 0; color: #0284c7;">${escapeXml(brandSettings.brandTitle)} — Bộ Thẻ Flashcards Cầm Tay</h2>
    <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Chủ đề: <strong>${escapeXml(deck.title)}</strong> (In giấy A4 hoặc giấy bìa cứng, cắt theo đường nét đứt)</p>
  </div>
  <div class="flashcards-grid">
    ${cards
      .map(
        (c) => `
      <div class="flashcard">
        <span class="scissors">✂ Cắt theo đường này</span>
        ${c.imageDataUrl ? `<img src="${c.imageDataUrl}" style="max-height: 90px; max-width: 140px; object-fit: contain; border-radius: 6px; margin-bottom: 6px;" alt="${escapeXml(c.word)}"/>` : ''}
        <div class="card-word">${escapeXml(c.word)}</div>
        <div class="card-phonetic">${escapeXml(c.phonetic)}</div>
        <div class="card-meaning">${escapeXml(c.meaning)}</div>
        <div class="card-example">“${escapeXml(c.example)}”</div>
        <div class="brand-tag">${escapeXml(brandSettings.brandTitle)} · ${escapeXml(deck.title)}</div>
      </div>`
      )
      .join('')}
  </div>
</body>
</html>`;
}

// -------------------------------------------------------------
// HELPER FOR 1-CLICK DOWNLOADING & PRINTING
// -------------------------------------------------------------
export function downloadFile(blob: Blob | string, filename: string, mimeType = 'text/plain') {
  const actualBlob = typeof blob === 'string' ? new Blob([blob], { type: mimeType }) : blob;
  const url = URL.createObjectURL(actualBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function openPrintDialog(htmlContent: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Vui lòng cho phép popup trình duyệt để mở cửa sổ in ấn.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}
