use tokio::sync::broadcast;

use crate::rpc::types::JsonRpcNotification;

pub type BroadcastTx = broadcast::Sender<JsonRpcNotification>;
pub type BroadcastRx = broadcast::Receiver<JsonRpcNotification>;

pub fn create_channel() -> (BroadcastTx, BroadcastRx) {
    broadcast::channel(256)
}
