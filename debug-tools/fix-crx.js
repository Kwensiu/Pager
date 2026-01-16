import fs from 'fs'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function tryExtractZipFromCrx(crxPath) {
  try {
    console.log(`=== 尝试从损坏的 CRX 文件中提取 ZIP 数据 ===`)
    console.log(`文件: ${crxPath}`)

    const data = fs.readFileSync(crxPath)
    console.log(`文件大小: ${data.length} bytes`)

    // 检查魔数
    const magic = data.toString('ascii', 0, 4)
    console.log(`魔数: "${magic}"`)

    if (magic !== 'Cr24') {
      console.log('❌ 不是 CRX 文件')
      return false
    }

    // 读取版本
    const version = data.readUInt32LE(4)
    console.log(`版本: ${version}`)

    // 读取公钥和签名长度
    const publicKeyLength = data.readUInt32LE(8)
    const signatureLength = data.readUInt32LE(12)
    console.log(`公钥长度: ${publicKeyLength} bytes`)
    console.log(`签名长度: ${signatureLength} bytes`)

    // 计算头部大小
    const headerSize = 16 + publicKeyLength + signatureLength
    console.log(`头部大小: ${headerSize} bytes`)

    if (headerSize >= data.length) {
      console.log('⚠️  头部大小超过文件大小，尝试搜索 ZIP 魔数...')

      // 搜索 ZIP 魔数
      const zipMagic = 'PK\x03\x04'
      let zipStart = -1

      for (let i = 16; i < Math.min(data.length - 4, 1000); i++) {
        if (data.toString('ascii', i, i + 4) === zipMagic) {
          zipStart = i
          break
        }
      }

      if (zipStart === -1) {
        console.log('❌ 未找到 ZIP 魔数')
        return false
      }

      console.log(`✅ 找到 ZIP 数据起始位置: ${zipStart}`)

      // 提取 ZIP 数据
      const zipData = data.slice(zipStart)
      console.log(`ZIP 数据大小: ${zipData.length} bytes`)

      // 验证 ZIP 数据
      if (zipData.length < 4) {
        console.log('❌ ZIP 数据太小')
        return false
      }

      const zipMagic2 = zipData.toString('ascii', 0, 4)
      if (zipMagic2 !== 'PK\x03\x04' && zipMagic2 !== 'PK\x05\x06' && zipMagic2 !== 'PK\x07\x08') {
        console.log('❌ ZIP 数据魔数无效')
        return false
      }

      // 创建修复后的文件
      const outputPath = crxPath.replace('.crx', '_fixed.zip')
      fs.writeFileSync(outputPath, zipData)
      console.log(`✅ 已创建修复后的文件: ${outputPath}`)

      return outputPath
    }

    console.log('✅ CRX 文件格式正常')
    return crxPath
  } catch (error) {
    console.error('❌ 修复失败:', error.message)
    return false
  }
}

// 从命令行参数获取文件路径
const filePath = process.argv[2]
if (!filePath) {
  console.log('用法: node fix-crx.js <crx-file-path>')
  process.exit(1)
}

const result = tryExtractZipFromCrx(filePath)
if (result) {
  console.log('\n✅ 处理成功!')
  if (result !== filePath) {
    console.log(`请尝试安装修复后的文件: ${result}`)
  }
} else {
  console.log('\n❌ 处理失败')
}
