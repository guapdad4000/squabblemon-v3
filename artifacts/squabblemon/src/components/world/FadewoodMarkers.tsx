import { forwardRef, useImperativeHandle, useState } from 'react';
import { BookOpen, Mail } from 'lucide-react';
import { getHostName } from '../../lib/fadewood/registry';

export type ProjectedMarker = { arcId: string; sourceId: string; label: string; x: number; y: number; visible: boolean };
export type FadewoodMarkersHandle = { update: (markers: ProjectedMarker[]) => void };

/** Camera updates repaint just the pins, leaving menus and campaign resolution idle. */
export const FadewoodMarkers = forwardRef<FadewoodMarkersHandle, {
  visible: boolean;
  unread: number;
  gifts: number;
  onInspect: (sourceId: string, arcId: string) => void;
}>(function FadewoodMarkers({ visible, unread, gifts, onInspect }, ref) {
  const [markers, setMarkers] = useState<ProjectedMarker[]>([]);
  useImperativeHandle(ref, () => ({ update: setMarkers }), []);
  const sources = new Set<string>();
  const unique = markers.filter(marker => {
    if (!marker.visible || sources.has(marker.sourceId)) return false;
    sources.add(marker.sourceId);
    return true;
  });
  return <div className="fadewood-world__markers" aria-label="Nearby story and mail markers" hidden={!visible}>{unique.map(marker => <button type="button" key={marker.sourceId} className={`fadewood-world__marker${marker.arcId === 'mail' ? ' fadewood-world__marker--mail' : ''}`}
    style={{ left: `${marker.x}%`, top: `${marker.y}%` }} onClick={() => onInspect(marker.sourceId, marker.arcId)}
    aria-label={marker.arcId === 'mail' ? `Open Mailman deliveries, ${gifts} gifts and ${unread} unread` : `View ${marker.label} with ${getHostName(marker.sourceId)}`}>
    {marker.arcId === 'mail' ? <Mail size={16} /> : <BookOpen size={16} />}<span>{marker.arcId === 'mail' ? marker.label : getHostName(marker.sourceId)}</span><small>{marker.arcId === 'mail' ? 'MAILMAN' : marker.label}</small>
  </button>)}</div>;
});
