import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Clock,
  Compass,
  ExternalLink,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Play,
  Pause,
  RefreshCw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type {
  CourierTrackingDTO,
  CourierTrackingStatus,
  OrderDTO,
} from '../shared/types.ts';
import { formatDateTime } from '../utils/format.ts';

interface CourierLiveMapProps {
  order: OrderDTO;
  authToken: string | null;
  onOrderUpdated?: (updatedOrder: OrderDTO) => void;
  compact?: boolean;
}

const MAPS_API_KEY = (
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
)?.trim();

function formatTrackingStatusLabel(status: CourierTrackingStatus): string {
  switch (status) {
    case 'awaiting_dispatch':
      return 'Prêt au départ · Showroom';
    case 'en_route':
      return 'Coursier en route (GPS actif)';
    case 'arriving_soon':
      return 'Arrivée imminente';
    case 'delivered':
      return 'Colis remis au destinataire';
  }
}

function getTrackingBadgeStyle(status: CourierTrackingStatus): string {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-950/90 text-emerald-100 border-emerald-700';
    case 'arriving_soon':
      return 'bg-[#C86D51] text-white border-[#b45b3f]';
    case 'en_route':
      return 'bg-[#141413] text-[#FAF7F2] border-[#3F3F46]';
    default:
      return 'bg-[#F2ECE1] text-[#141413] border-[#DED8CC]';
  }
}

function sanitizePhoneForLink(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function sanitizeWhatsAppNumber(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface PolylineHandle {
  setMap: (map: unknown) => void;
  setPath: (path: unknown) => void;
}

// --- Google Maps Route Polyline & Auto-Fit Camera Overlay ---
const GoogleMapsRouteOverlay: React.FC<{
  tracking: CourierTrackingDTO;
  followCourier: boolean;
}> = ({ tracking, followCourier }) => {
  const map = useMap();
  const coreLib = useMapsLibrary('core');
  const mapsLib = useMapsLibrary('maps');
  const routesLib = useMapsLibrary('routes');
  const plannedLineRef = useRef<PolylineHandle | null>(null);
  const completedLineRef = useRef<PolylineHandle | null>(null);
  const initialFitOrderRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    if (plannedLineRef.current) {
      plannedLineRef.current.setMap(null);
    }
    if (completedLineRef.current) {
      completedLineRef.current.setMap(null);
    }

    const waypointsPath: LatLngPoint[] = tracking.waypoints.map((w) => ({
      lat: w.lat,
      lng: w.lng,
    }));

    const PolylineCtor = (
      mapsLib as unknown as {
        Polyline?: new (opts: Record<string, unknown>) => PolylineHandle;
      }
    ).Polyline;

    if (PolylineCtor && waypointsPath.length >= 2) {
      const planned = new PolylineCtor({
        path: waypointsPath,
        geodesic: true,
        strokeColor: '#78746C',
        strokeOpacity: 0.45,
        strokeWeight: 4,
        map,
      });
      plannedLineRef.current = planned;

      // Highlight traveled segment up to courier's current position
      const splitIdx = Math.max(
        1,
        Math.min(
          waypointsPath.length - 1,
          Math.floor((tracking.progressPct / 100) * (waypointsPath.length - 1)) + 1
        )
      );
      const completedPath: LatLngPoint[] = [
        ...waypointsPath.slice(0, splitIdx),
        { lat: tracking.currentLat, lng: tracking.currentLng },
      ];

      const completed = new PolylineCtor({
        path: completedPath,
        geodesic: true,
        strokeColor: '#C86D51',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map,
      });
      completedLineRef.current = completed;
    }

    // Optional modern Routes API route smoothing when available
    let cancelled = false;
    if (routesLib && waypointsPath.length >= 2) {
      try {
        const RouteCtor = (
          routesLib as unknown as {
            Route?: {
              computeRoutes?: (
                req: Record<string, unknown>
              ) => Promise<{ routes?: Array<{ path?: unknown }> }>;
            };
          }
        ).Route;

        if (RouteCtor && typeof RouteCtor.computeRoutes === 'function') {
          RouteCtor.computeRoutes({
            origin: { lat: tracking.originLat, lng: tracking.originLng },
            destination: {
              lat: tracking.destinationLat,
              lng: tracking.destinationLng,
            },
            travelMode: 'DRIVING',
            fields: ['path'],
          })
            .then((res) => {
              if (cancelled || !res?.routes?.[0]) return;
              const routePath = res.routes[0].path;
              if (Array.isArray(routePath) && routePath.length > 1 && plannedLineRef.current) {
                plannedLineRef.current.setPath(routePath);
              }
            })
            .catch(() => {
              // Keep city waypoints polyline seamlessly if Routes API call is unavailable
            });
        }
      } catch {
        // Keep waypoints polyline fallback
      }
    }

    return () => {
      cancelled = true;
      if (plannedLineRef.current) {
        plannedLineRef.current.setMap(null);
        plannedLineRef.current = null;
      }
      if (completedLineRef.current) {
        completedLineRef.current.setMap(null);
        completedLineRef.current = null;
      }
    };
  }, [
    map,
    mapsLib,
    routesLib,
    tracking.originLat,
    tracking.originLng,
    tracking.destinationLat,
    tracking.destinationLng,
    tracking.currentLat,
    tracking.currentLng,
    tracking.progressPct,
    tracking.waypoints,
  ]);

  useEffect(() => {
    if (!map) return;
    if (
      initialFitOrderRef.current !== tracking.orderId &&
      tracking.waypoints.length >= 2 &&
      coreLib?.LatLngBounds
    ) {
      const bounds = new coreLib.LatLngBounds();
      for (const wp of tracking.waypoints) {
        bounds.extend({ lat: wp.lat, lng: wp.lng });
      }
      bounds.extend({ lat: tracking.currentLat, lng: tracking.currentLng });
      map.fitBounds(bounds, 48);
      initialFitOrderRef.current = tracking.orderId;
    } else if (followCourier) {
      map.panTo({ lat: tracking.currentLat, lng: tracking.currentLng });
    }
  }, [
    map,
    coreLib,
    followCourier,
    tracking.orderId,
    tracking.currentLat,
    tracking.currentLng,
    tracking.waypoints,
  ]);

  return null;
};

// --- Google Maps Interactive Surface (using @vis.gl/react-google-maps) ---
const GoogleMapsCourierSurface: React.FC<{
  tracking: CourierTrackingDTO;
  order: OrderDTO;
  followCourier: boolean;
  onUnavailable: () => void;
}> = ({ tracking, order, followCourier, onUnavailable }) => {
  const status = useApiLoadingStatus();
  const [courierMarkerRef, courierMarker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);

  useEffect(() => {
    if (
      status === APILoadingStatus.FAILED ||
      status === APILoadingStatus.AUTH_FAILURE
    ) {
      onUnavailable();
    }
  }, [status, onUnavailable]);

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return null;
  }

  return (
    <div className="relative w-full h-[340px] md:h-[400px] rounded-xl overflow-hidden border border-[#DED8CC]">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={{ lat: tracking.currentLat, lng: tracking.currentLng }}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        streetViewControl={false}
        mapTypeControl={false}
        className="w-full h-full"
      >
        <GoogleMapsRouteOverlay
          tracking={tracking}
          followCourier={followCourier}
        />

        {/* Showroom Hub Origin */}
        <AdvancedMarker
          position={{ lat: tracking.originLat, lng: tracking.originLng }}
          title={tracking.hubName}
        >
          <Pin background="#141413" borderColor="#FAF7F2" glyphColor="#D4A373">
            H
          </Pin>
        </AdvancedMarker>

        {/* Client Destination */}
        <AdvancedMarker
          position={{
            lat: tracking.destinationLat,
            lng: tracking.destinationLng,
          }}
          title={`${order.shippingAddress}, ${order.shippingCity}`}
        >
          <Pin background="#065F46" borderColor="#FAF7F2" glyphColor="#FFFFFF">
            ★
          </Pin>
        </AdvancedMarker>

        {/* Live Moving Courier Marker */}
        <AdvancedMarker
          ref={courierMarkerRef}
          position={{ lat: tracking.currentLat, lng: tracking.currentLng }}
          onClick={() => setInfoOpen((prev) => !prev)}
          title={`${tracking.courierName} · ${tracking.vehicleLabel}`}
          zIndex={50}
        >
          <div className="relative flex items-center justify-center">
            {tracking.status !== 'delivered' && (
              <span className="absolute w-11 h-11 rounded-full bg-[#C86D51]/35 animate-ping" />
            )}
            <div className="relative w-9 h-9 rounded-full bg-[#141413] border-2 border-[#FAF7F2] shadow-lg flex items-center justify-center text-[#D4A373]">
              <Truck className="w-4 h-4" />
            </div>
          </div>
        </AdvancedMarker>

        {infoOpen && courierMarker && (
          <InfoWindow
            anchor={courierMarker}
            maxWidth={240}
            onCloseClick={() => setInfoOpen(false)}
          >
            <div className="text-xs text-[#141413] space-y-1 p-0.5">
              <div className="font-semibold">{tracking.courierName}</div>
              <div className="text-[11px] text-[#57534E]">
                {tracking.lastCheckpoint}
              </div>
              <div className="font-mono text-[11px] text-[#C86D51]">
                {tracking.status === 'delivered'
                  ? 'Colis livré'
                  : `ETA ~${tracking.etaMinutes} min · ${tracking.distanceRemainingKm} km`}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

// --- Pan-African Architectural Topographic Live Radar Map (Built-in Fallback) ---
const ArchitecturalRouteRadar: React.FC<{
  tracking: CourierTrackingDTO;
  order: OrderDTO;
}> = ({ tracking, order }) => {
  const projected = useMemo(() => {
    const allPts = [
      ...tracking.waypoints,
      { lat: tracking.currentLat, lng: tracking.currentLng, label: 'Coursier' },
    ];
    const lats = allPts.map((p) => p.lat);
    const lngs = allPts.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(0.015, maxLat - minLat);
    const lngSpan = Math.max(0.015, maxLng - minLng);

    const padX = 76;
    const padY = 58;
    const width = 760;
    const height = 340;
    const drawW = width - padX * 2;
    const drawH = height - padY * 2;

    const project = (lat: number, lng: number) => {
      const nx = (lng - minLng) / lngSpan;
      const ny = (maxLat - lat) / latSpan;
      return {
        x: Number((padX + nx * drawW).toFixed(1)),
        y: Number((padY + ny * drawH).toFixed(1)),
      };
    };

    const wpCoords = tracking.waypoints.map((wp) => ({
      ...wp,
      ...project(wp.lat, wp.lng),
    }));
    const courierPt = project(tracking.currentLat, tracking.currentLng);

    const activeIdx = Math.max(
      1,
      Math.min(
        wpCoords.length,
        Math.floor((tracking.progressPct / 100) * Math.max(1, wpCoords.length - 1)) + 1
      )
    );
    const traveledPts = [...wpCoords.slice(0, activeIdx), courierPt];

    return {
      width,
      height,
      wpCoords,
      courierPt,
      fullPolyline: wpCoords.map((p) => `${p.x},${p.y}`).join(' '),
      traveledPolyline: traveledPts.map((p) => `${p.x},${p.y}`).join(' '),
    };
  }, [tracking]);

  const origin = projected.wpCoords[0];
  const dest = projected.wpCoords[projected.wpCoords.length - 1];

  return (
    <div className="relative w-full h-[340px] md:h-[380px] rounded-xl overflow-hidden border border-[#DED8CC] bg-[#EFE9DD] select-none">
      {/* Topographic HUD Corner Coordinates */}
      <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-[#141413]/85 text-[#FAF7F2] text-[11px] font-mono backdrop-blur-xs flex items-center gap-2">
        <Compass className="w-3.5 h-3.5 text-[#D4A373]" />
        <span>
          {order.shippingCity.toUpperCase()} · {tracking.currentLat.toFixed(4)}°,{' '}
          {tracking.currentLng.toFixed(4)}°
        </span>
      </div>

      <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md bg-white/90 border border-[#DED8CC] text-[11px] font-mono text-[#141413]">
        {tracking.status === 'delivered'
          ? 'Arrivé à destination'
          : `${tracking.speedKmh} km/h · Cap ${tracking.headingDeg}°`}
      </div>

      <svg
        viewBox={`0 0 ${projected.width} ${projected.height}`}
        className="w-full h-full"
        role="img"
        aria-label={`Carte de suivi en direct du coursier vers ${order.shippingCity}`}
      >
        <defs>
          <pattern
            id="vera-arch-grid"
            width="38"
            height="38"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 38 0 L 0 0 0 38"
              fill="none"
              stroke="#DED6C6"
              strokeWidth="0.9"
            />
          </pattern>
          <radialGradient id="courier-beacon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C86D51" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#C86D51" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Architectural Grid & Urban Contour Rings */}
        <rect width="100%" height="100%" fill="url(#vera-arch-grid)" />
        <ellipse
          cx={projected.width / 2}
          cy={projected.height / 2}
          rx="270"
          ry="135"
          fill="none"
          stroke="#D6CEBE"
          strokeWidth="1"
          strokeDasharray="6 6"
        />
        <ellipse
          cx={projected.width / 2}
          cy={projected.height / 2}
          rx="165"
          ry="82"
          fill="none"
          stroke="#D6CEBE"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Planned Route Path */}
        {projected.fullPolyline && (
          <polyline
            points={projected.fullPolyline}
            fill="none"
            stroke="#9C9589"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="8 6"
          />
        )}

        {/* Active Traveled Route Path */}
        {projected.traveledPolyline && (
          <polyline
            points={projected.traveledPolyline}
            fill="none"
            stroke="#C86D51"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Intermediate Checkpoints */}
        {projected.wpCoords.slice(1, -1).map((wp, idx) => {
          const passed =
            tracking.progressPct >=
            ((idx + 1) / Math.max(1, projected.wpCoords.length - 1)) * 100;
          return (
            <g key={`${wp.label}-${idx}`}>
              <circle
                cx={wp.x}
                cy={wp.y}
                r="5"
                fill={passed ? '#C86D51' : '#FAF7F2'}
                stroke="#141413"
                strokeWidth="1.5"
              />
            </g>
          );
        })}

        {/* Showroom Origin Marker */}
        {origin && (
          <g>
            <circle
              cx={origin.x}
              cy={origin.y}
              r="11"
              fill="#141413"
              stroke="#FAF7F2"
              strokeWidth="2.5"
            />
            <text
              x={origin.x}
              y={origin.y + 3.5}
              textAnchor="middle"
              fill="#D4A373"
              fontSize="10"
              fontWeight="700"
              fontFamily="monospace"
            >
              H
            </text>
            <rect
              x={Math.max(12, origin.x - 68)}
              y={origin.y + 16}
              width="136"
              height="20"
              rx="4"
              fill="#141413"
              fillOpacity="0.88"
            />
            <text
              x={Math.max(80, origin.x)}
              y={origin.y + 29}
              textAnchor="middle"
              fill="#FAF7F2"
              fontSize="9.5"
              fontWeight="600"
            >
              Showroom · Départ
            </text>
          </g>
        )}

        {/* Destination Marker */}
        {dest && (
          <g>
            <circle
              cx={dest.x}
              cy={dest.y}
              r="12"
              fill="#065F46"
              stroke="#FAF7F2"
              strokeWidth="2.5"
            />
            <text
              x={dest.x}
              y={dest.y + 4}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="700"
            >
              ★
            </text>
            <rect
              x={Math.min(projected.width - 156, Math.max(12, dest.x - 72))}
              y={dest.y - 36}
              width="144"
              height="20"
              rx="4"
              fill="#065F46"
              fillOpacity="0.92"
            />
            <text
              x={Math.min(projected.width - 84, Math.max(84, dest.x))}
              y={dest.y - 23}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="9.5"
              fontWeight="600"
            >
              Destination · {order.shippingCity}
            </text>
          </g>
        )}

        {/* Live Moving Courier Marker */}
        <g
          style={{
            transition: 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <circle
            cx={projected.courierPt.x}
            cy={projected.courierPt.y}
            r="28"
            fill="url(#courier-beacon-glow)"
          />
          {tracking.status !== 'delivered' && (
            <circle
              cx={projected.courierPt.x}
              cy={projected.courierPt.y}
              r="20"
              fill="none"
              stroke="#C86D51"
              strokeWidth="2"
              strokeOpacity="0.55"
            >
              <animate
                attributeName="r"
                from="13"
                to="27"
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from="0.8"
                to="0"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          <circle
            cx={projected.courierPt.x}
            cy={projected.courierPt.y}
            r="14"
            fill="#141413"
            stroke="#FAF7F2"
            strokeWidth="3"
          />
          <circle
            cx={projected.courierPt.x}
            cy={projected.courierPt.y}
            r="4.5"
            fill="#D4A373"
          />
        </g>
      </svg>

      {/* Bottom Live Checkpoint Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 px-3.5 py-2 rounded-lg bg-white/95 border border-[#DED8CC] backdrop-blur-xs flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[#141413] font-medium">
          <Navigation className="w-3.5 h-3.5 text-[#C86D51] shrink-0" />
          <span className="truncate max-w-[360px] sm:max-w-[460px]">
            {tracking.lastCheckpoint}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#57534E]">
          {tracking.progressPct}% du trajet
        </span>
      </div>
    </div>
  );
};

export const CourierLiveMap: React.FC<CourierLiveMapProps> = ({
  order,
  authToken,
  onOrderUpdated,
  compact = false,
}) => {
  const [tracking, setTracking] = useState<CourierTrackingDTO | null>(
    order.tracking ?? null
  );
  const [autoStream, setAutoStream] = useState<boolean>(
    order.status === 'shipped' && order.tracking?.status !== 'delivered'
  );
  const [followCourier, setFollowCourier] = useState<boolean>(true);
  const [loadingPulse, setLoadingPulse] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mapsUnavailable, setMapsUnavailable] = useState<boolean>(false);

  // Sync local tracking when selected order prop changes
  useEffect(() => {
    setTracking(order.tracking ?? null);
    setError(null);
    setAutoStream(
      order.status === 'shipped' && order.tracking?.status !== 'delivered'
    );
  }, [order.id, order.status, order.tracking]);

  // Listen cleanly for Maps auth failures (standard production fallback)
  useEffect(() => {
    const win = window as unknown as { gm_authFailure?: () => void };
    const prev = win.gm_authFailure;
    win.gm_authFailure = () => {
      setMapsUnavailable(true);
      if (typeof prev === 'function') prev();
    };
    return () => {
      win.gm_authFailure = prev;
    };
  }, []);

  const buildHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  }, [authToken]);

  const fetchLatestTracking = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/orders/${order.id}/tracking?paymentIntentId=${encodeURIComponent(
          order.paymentIntentId
        )}`,
        { headers: buildHeaders() }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.tracking) {
        setTracking(data.tracking);
      }
      if (data.order && onOrderUpdated) {
        onOrderUpdated(data.order);
      }
    } catch {
      // Transient network error ignored during background refresh
    }
  }, [order.id, order.paymentIntentId, buildHeaders, onOrderUpdated]);

  const handlePulseTelemetry = useCallback(
    async (stepDelta = 15) => {
      setLoadingPulse(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/orders/${order.id}/tracking/pulse?paymentIntentId=${encodeURIComponent(
            order.paymentIntentId
          )}`,
          {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ stepDelta }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error || 'Impossible d’actualiser la position GPS.'
          );
        }
        if (data.tracking) {
          setTracking(data.tracking);
          if (data.tracking.status === 'delivered') {
            setAutoStream(false);
          }
        }
        if (data.order && onOrderUpdated) {
          onOrderUpdated(data.order);
        }
      } catch (err: unknown) {
        setAutoStream(false);
        setError(
          err instanceof Error ? err.message : 'Erreur de télémétrie GPS'
        );
      } finally {
        setLoadingPulse(false);
      }
    },
    [order.id, order.paymentIntentId, buildHeaders, onOrderUpdated]
  );

  // Real-time live courier polling & movement loop when active
  useEffect(() => {
    if (!autoStream || !tracking || tracking.status === 'delivered') return;
    if (order.status === 'pending_payment' || order.status === 'cancelled' || order.status === 'payment_failed') {
      return;
    }

    const interval = setInterval(() => {
      if (order.status === 'shipped') {
        handlePulseTelemetry(10);
      } else {
        fetchLatestTracking();
      }
    }, 3200);

    return () => clearInterval(interval);
  }, [
    autoStream,
    tracking?.status,
    order.status,
    handlePulseTelemetry,
    fetchLatestTracking,
  ]);

  // Fetch tracking lazily if order didn't carry it yet
  useEffect(() => {
    if (!tracking) {
      fetchLatestTracking();
    }
  }, [tracking, fetchLatestTracking]);

  if (!tracking) {
    return (
      <div className="p-6 bg-white border border-[#E5E0D5] rounded-2xl text-xs text-[#78746C]">
        Initialisation de la télémétrie GPS du coursier...
      </div>
    );
  }

  const canDispatchOrPulse =
    order.status === 'paid' ||
    order.status === 'preparing' ||
    order.status === 'shipped';

  const useGoogleMaps = Boolean(MAPS_API_KEY) && !mapsUnavailable;
  const googleMapsDirUrl = `https://www.google.com/maps/dir/?api=1&origin=${tracking.currentLat},${tracking.currentLng}&destination=${tracking.destinationLat},${tracking.destinationLng}&travelmode=driving`;

  return (
    <div className="bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden shadow-xs">
      {/* Top Status & Telemetry Header */}
      <div className="px-5 py-4 bg-[#F2ECE1] border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[#C86D51] font-semibold">
              <Navigation className="w-3.5 h-3.5" />
              <span>Suivi GPS Coursier en Direct</span>
            </span>
            <span className="text-[#DED8CC]">·</span>
            <span className="font-mono text-xs font-semibold text-[#141413]">
              {order.orderNumber}
            </span>
          </div>
          <h3 className="text-lg font-display font-semibold text-[#141413]">
            {tracking.hubName} → {order.shippingAddress}, {order.shippingCity}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium ${getTrackingBadgeStyle(
              tracking.status
            )}`}
          >
            {tracking.status !== 'delivered' && tracking.status !== 'awaiting_dispatch' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span>{formatTrackingStatusLabel(tracking.status)}</span>
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className={compact ? 'p-4 space-y-4' : 'p-5 md:p-6 space-y-5'}>
        {/* Live ETA & Distance KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#FAF7F2] border border-[#E5E0D5] rounded-xl">
            <span className="text-[11px] text-[#78746C] flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#C86D51]" />
              <span>Arrivée estimée (ETA)</span>
            </span>
            <strong className="text-base font-mono text-[#141413] mt-0.5 block">
              {tracking.status === 'delivered'
                ? 'Livré'
                : `${tracking.etaMinutes} min`}
            </strong>
          </div>

          <div className="p-3.5 bg-[#FAF7F2] border border-[#E5E0D5] rounded-xl">
            <span className="text-[11px] text-[#78746C] flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#C86D51]" />
              <span>Distance restante</span>
            </span>
            <strong className="text-base font-mono text-[#141413] mt-0.5 block">
              {tracking.distanceRemainingKm.toFixed(1)} km / {tracking.totalDistanceKm.toFixed(1)} km
            </strong>
          </div>

          <div className="p-3.5 bg-[#FAF7F2] border border-[#E5E0D5] rounded-xl">
            <span className="text-[11px] text-[#78746C] flex items-center gap-1">
              <Truck className="w-3 h-3 text-[#C86D51]" />
              <span>Progression trajet</span>
            </span>
            <strong className="text-base font-mono text-[#141413] mt-0.5 block">
              {tracking.progressPct}%
            </strong>
          </div>

          <div className="p-3.5 bg-[#FAF7F2] border border-[#E5E0D5] rounded-xl">
            <span className="text-[11px] text-[#78746C] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#C86D51]" />
              <span>Dernier signal GPS</span>
            </span>
            <strong className="text-xs font-mono text-[#141413] mt-1 block">
              {formatDateTime(tracking.updatedAt)}
            </strong>
          </div>
        </div>

        {/* Route Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-[#EFE9DD] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C86D51] transition-all duration-500 rounded-full"
              style={{ width: `${tracking.progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#78746C]">
            <span>Showroom Départ</span>
            <span className="font-medium text-[#141413]">
              {tracking.lastCheckpoint}
            </span>
            <span>Votre Résidence</span>
          </div>
        </div>

        {/* Interactive Map Container (Google Maps Platform or Architectural Radar) */}
        {useGoogleMaps && MAPS_API_KEY ? (
          <APIProvider
            apiKey={MAPS_API_KEY}
            libraries={['marker', 'routes']}
            language="fr"
            region="CM"
          >
            <GoogleMapsCourierSurface
              tracking={tracking}
              order={order}
              followCourier={followCourier}
              onUnavailable={() => setMapsUnavailable(true)}
            />
          </APIProvider>
        ) : (
          <ArchitecturalRouteRadar tracking={tracking} order={order} />
        )}

        {error && (
          <div
            className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Courier Identity & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-[#FAF7F2] border border-[#E5E0D5] rounded-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#141413] text-[#D4A373] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-[#141413]">
                {tracking.courierName} ·{' '}
                <span className="font-mono text-[#57534E]">
                  {tracking.vehiclePlate}
                </span>
              </div>
              <div className="text-[#57534E]">{tracking.vehicleLabel}</div>
              <div className="text-[11px] font-mono text-[#78746C]">
                {tracking.courierPhone}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`tel:${sanitizePhoneForLink(tracking.courierPhone)}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#DED8CC] text-[#141413] rounded-xl hover:bg-[#F2ECE1] transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-[#C86D51]" />
              <span>Appeler</span>
            </a>

            <a
              href={`https://wa.me/${sanitizeWhatsAppNumber(
                tracking.courierPhone
              )}?text=${encodeURIComponent(
                `Bonjour ${tracking.courierName}, je suis le destinataire de la commande Maison Véra ${order.orderNumber}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#DED8CC] text-[#141413] rounded-xl hover:bg-[#F2ECE1] transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
              <span>WhatsApp</span>
            </a>

            <a
              href={googleMapsDirUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#DED8CC] text-[#141413] rounded-xl hover:bg-[#F2ECE1] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#57534E]" />
              <span>Google Maps</span>
            </a>

            {useGoogleMaps && (
              <button
                type="button"
                onClick={() => setFollowCourier((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                  followCourier
                    ? 'bg-[#141413] text-[#FAF7F2] border-[#141413]'
                    : 'bg-white text-[#141413] border-[#DED8CC]'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>Caméra centrée</span>
              </button>
            )}

            {canDispatchOrPulse && tracking.status !== 'delivered' && (
              <>
                <button
                  type="button"
                  onClick={() => setAutoStream((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                    autoStream
                      ? 'bg-emerald-900 text-white border-emerald-900'
                      : 'bg-white text-[#141413] border-[#DED8CC] hover:bg-[#F2ECE1]'
                  }`}
                >
                  {autoStream ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Temps réel actif</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Suivi temps réel</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={loadingPulse}
                  onClick={() => handlePulseTelemetry(18)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-[#D4A373] ${
                      loadingPulse ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {order.status === 'shipped'
                      ? 'Actualiser GPS'
                      : 'Lancer livraison GPS'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
