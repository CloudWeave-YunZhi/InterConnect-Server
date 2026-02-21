// 定义接口
export interface AppConfig {
    server: {
        addr: string
        port: number
    }
    logger:{
        enable: boolean
        level: string
        pretty: boolean
    }
    ratelimit: {
        windowMs: number
        limit: number
        message: string
    }
}
export interface NodeRecord {
  id?: number;
  uuid: string;
  servername: string;
  token_hash: string;
  create_at: string;
}

export interface NodePublicInfo {
    uuid: string;
    servername: string;
    stat: number | null;
    create_at: string
}