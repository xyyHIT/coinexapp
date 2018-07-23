module.exports = {
  coinex: {
    access_id: 'FFFF0DE8AFF3420A88E8F3FA72293109',
    secret_key: 'FB98C84D271140E5967C4EE16940D81956F5CB6A459EEB70',
    // access_id: '6A53206AC2D04AA2BBC889F750FD67B8',
    // secret_key: 'FFA46235D8A74E50A55613C59680A3D73153238727BE575D',
  },
  log4js: {
    appenders: {
      out: { type: 'stdout' },
      app: { type: 'file', filename: 'application.log' }
    },
    categories: {
      default: { appenders: [ 'out', 'app' ], level: 'info' }
    }
  },
  zbg: {
    access_id: '7emF7KtZrs07emF7KtZrs1',
    secret_key: '77bcd0aa61128921d732342574cc0f0f',
  }
}