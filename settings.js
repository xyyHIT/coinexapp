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
      }
    },
    categories: {
      default: {
        appenders: ['out', 'app'],
        level: 'info'
      }
    }
  },
  zbg: {
    access_id: '7emF7KtZrs07emF7KtZrs1',
    secret_key: '77bcd0aa61128921d732342574cc0f0f',
  },
  asiaex: {
    // api_key: 'qONAkTJAkKoz6kHM6rWrvySSX0mNx61r',
    // secret_key: '0eP2nZtOHRuouqmc7Y8l5vFW2CYlIduK',
    // public_key: '-----BEGIN PUBLIC KEY-----\n' +
    //   'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCg2avSF1Fwx4o14m3pNXlBR5Cow9bWd+FOdNfL6kquPJSavzxo9kOnhbsY4L51Nc5GybGfYekTZbzk49yHJd99oKRMBv4BecHzJfG9PUFklZh/mDWZzipAwMpVoMSyKZywD2HrXvF4dfPg8l1Yfb9VYx0u9ygRv2wsYiMzUsm9AwIDAQAB\n' +
    //   '-----END PUBLIC KEY-----'
    api_key: 'rMtcoeKQ4pt4dYySkqyPQzBVfHEEh93B',
    secret_key: 'F7L63G3HFizw466RIIhNguWbtFSfJjTS',
    public_key: '-----BEGIN PUBLIC KEY-----\n' +
      'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCZHUUywjBVqLzYrg8blvBJXTGF2SpM+MGKfMceEvDWErOv4b7DKFnINmTEniLW7465yZpAi0t3IqS7j3f0hFLYdX1yPZizrsHiN6qiepU0j2mJaRYS1e0A4L6jteTDsoZmGyYNd0GVGfVnW4GEEAU7sqGGrZ5/ZYIowWnTJGWqCQIDAQAB\n' +
      '-----END PUBLIC KEY-----'
  }
}