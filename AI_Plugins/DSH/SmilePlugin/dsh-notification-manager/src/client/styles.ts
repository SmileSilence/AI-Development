export const notificationManagerStyles = String.raw`
[data-smilexx-notification-manager] {
  color: var(--dsw-alias-label-primary);
  display: grid;
  gap: 16px;
  max-width: 760px;
}
[data-smilexx-notification-manager] .smilexx-notification-manager-section {
  border: 1px solid var(--dsw-alias-border-l4);
  border-radius: 12px;
  padding: 4px 16px;
}
[data-smilexx-notification-manager] .smilexx-notification-manager-row {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  min-height: 64px;
}
[data-smilexx-notification-manager] .smilexx-notification-manager-row + .smilexx-notification-manager-row { border-top: 1px solid var(--dsw-alias-border-l4); }
[data-smilexx-notification-manager] .smilexx-notification-manager-copy { display: grid; gap: 4px; min-width: 0; }
[data-smilexx-notification-manager] .smilexx-notification-manager-label { color: var(--dsw-alias-label-primary); font-weight: 500; }
[data-smilexx-notification-manager] .smilexx-notification-manager-description,
[data-smilexx-notification-manager] .smilexx-notification-manager-status { color: var(--dsw-alias-label-secondary); font-size: 12px; }
[data-smilexx-notification-manager] .smilexx-notification-manager-select {
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  min-width: 128px;
  padding: 7px 10px;
  text-align: left;
}
[data-smilexx-notification-manager] .smilexx-notification-manager-select:hover { background: var(--dsw-alias-interactive-bg-hover); }
[data-smilexx-notification-manager] .smilexx-notification-manager-actions { align-items: center; display: flex; gap: 12px; }
[data-smilexx-notification-manager] .smilexx-notification-manager-error { color: var(--dsw-alias-state-danger-primary, var(--dsw-alias-label-primary)); }
`
