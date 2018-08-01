module.exports = {
  coinex: {
    access_id: 'FFFF0DE8AFF3420A88E8F3FA72293109',
    secret_key: 'FB98C84D271140E5967C4EE16940D81956F5CB6A459EEB70',
    // access_id: '6A53206AC2D04AA2BBC889F750FD67B8',
    // secret_key: 'FFA46235D8A74E50A55613C59680A3D73153238727BE575D',
  },
  log4js: {
    appenders: {
      out: {
        type: 'stdout'
      },
      app: {
        type: 'file',
        filename: 'application.log'
      },
      balance: {
        type: 'file',
        filename: 'balance.log'
      }
    },
    categories: {
      default: {
        appenders: ['out', 'app'],
        level: 'info'
      },
      balance: {
        appenders: ['out', 'balance'],
        level: 'info'
      }
    }
  },
  zbg: [{
      access_id: '7emEfjwxMLg7emEfjwxMLh',
      secret_key: '4ebc27cdb955561242f0385e6a81cadb',
    },
    {
      access_id: '7evyaZ9BReC7evyaZ9BReD',
      secret_key: '9d394bd81d0cea7725a9b79a7b19bcf9',
    },
  ],
  // 第一个是程序开始时卖出BAC的账户
  asiaex: [{
    api_key: 'Vnzb9PG32VaxkLEAE0VeP8UmlCcJDQYF',
    secret_key: 'EUfoYbhJ8dVq0ka6P8oL4WioudQ7LiNQ',
    public_key: '-----BEGIN PUBLIC KEY-----\n' +
      'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCUrMtWdtspm6BRwpGnAmzNIY6BxjuQ+AwKpRt8nD2K6U7E024hdhRru3A9aW4CXvZcer4t/59e68OlmSLDq74hjT1yF3efI5IgU6bqqNy7xaTTHDvkRWbhlKm8ZF67E2DIarEvXdKajtR7ABcmJktgsXlxClGV62DxURRsZfjtWwIDAQAB\n' +
      '-----END PUBLIC KEY-----'
  }, {
    api_key: 'sdXaK9bYdsFFIIK9cLx2injCRqYmuzDz',
    secret_key: 'KRORxdQwd8mBqJHPvjR6arTO4EeQEHrN',
    public_key: '-----BEGIN PUBLIC KEY-----\n' +
      'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCyN77S2w3XOO6P8Du90xkf05QRgsFydhuKovuwG7TxBncf3DYsSSN54xuJZgrTq7xtXhw4LK7SeLilQkBwYdrKwZgM7963b/T4IyN0oQGW5ZsqvcFyTQCmktDoZhC55zminbudQZPZ4gjWz+vpUIG1xj2i4j0+BZlSd8qkUANh7wIDAQAB\n' +
      '-----END PUBLIC KEY-----'
  }]



}