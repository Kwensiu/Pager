#!/usr/bin/env node

import fs from 'fs'

// 模拟 CRX 文件解析
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function analyzeCrxFile(crxPath) {
  try {
    console.log(`=== 分析 CRX 文件: ${crxPath} ===`)

    if (!fs.existsSync(crxPath)) {
      console.error('❌ 文件不存在')
      return
    }

    const stats = fs.statSync(crxPath)
    console.log(`📁 文件大小: ${stats.size} bytes`)

    const data = fs.readFileSync(crxPath)
    console.log(`📊 读取数据大小: ${data.length} bytes`)

    if (data.length < 4) {
      console.error('❌ 文件太小，无法读取魔数')
      return
    }

    const magic = data.toString('ascii', 0, 4)
    console.log(`🔮 魔数: "${magic}"`)

    if (magic !== 'Cr24') {
      console.log('⚠️  不是标准的 CRX 文件')

      // 检查是否是 ZIP 文件
      const zipMagic = data.toString('ascii', 0, 4)
      if (zipMagic === 'PK\x03\x04' || zipMagic === 'PK\x05\x06' || zipMagic === 'PK\x07\x08') {
        console.log('✅ 这是一个 ZIP 文件，可以作为扩展安装')
      } else {
        console.log('❌ 既不是 CRX 也不是 ZIP 文件')
        console.log(
          `🔍 前16字节: ${Array.from(data.slice(0, 16))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(' ')}`
        )
      }
      return
    }

    console.log('✅ 有效的 CRX 魔数')

    if (data.length < 16) {
      console.error('❌ 文件太小，无法读取 CRX 头')
      return
    }

    const version = data.readUInt32LE(4)
    console.log(`📋 CRX 版本: ${version}`)

    if (version !== 2 && version !== 3) {
      console.log(`⚠️  不支持的 CRX 版本: ${version}`)
    }

    const publicKeyLength = data.readUInt32LE(8)
    const signatureLength = data.readUInt32LE(12)
    console.log(`🔑 公钥长度: ${publicKeyLength} bytes`)
    console.log(`✍️  签名长度: ${signatureLength} bytes`)

    const headerSize = 16 + publicKeyLength + signatureLength
    console.log(`📦 头部大小: ${headerSize} bytes`)

    if (headerSize >= data.length) {
      console.error('❌ 头部大小超过文件大小')
      return
    }

    const zipDataSize = data.length - headerSize
    console.log(`🗜️  ZIP 数据大小: ${zipDataSize} bytes`)

    // 尝试读取 ZIP 数据的开头
    const zipData = data.slice(headerSize)
    if (zipData.length >= 4) {
      const zipMagic = zipData.toString('ascii', 0, 4)
      console.log(`🗜️  ZIP 魔数: "${zipMagic}"`)

      if (zipMagic === 'PK\x03\x04' || zipMagic === 'PK\x05\x06' || zipMagic === 'PK\x07\x08') {
        console.log('✅ ZIP 数据有效')
      } else {
        console.log('⚠️  ZIP 数据可能损坏')
        console.log(
          `🔍 ZIP 前16字节: ${Array.from(zipData.slice(0, 16))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(' ')}`
        )
      }
    }

    console.log('✅ CRX 文件分析完成')
  } catch (error) {
    console.error('❌ 分析失败:', error.message)
  }
}

// 从命令行参数获取文件路径
const filePath = process.argv[2]
if (!filePath) {
  console.log('用法: node debug-crx.js <crx-file-path>')
  process.exit(1)
}

analyzeCrxFile(filePath)
