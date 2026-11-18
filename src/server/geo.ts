import type { CourierWaypoint } from '../shared/types.ts';

interface CityRouteTemplate {
  hubName: string;
  courierName: string;
  courierPhone: string;
  vehicleLabel: string;
  vehiclePlate: string;
  waypoints: CourierWaypoint[];
}

const CITY_TEMPLATES: Record<string, CityRouteTemplate> = {
  douala: {
    hubName: 'Galerie Maison Véra · Bonapriso Douala',
    courierName: 'Jean-Baptiste Mbarga',
    courierPhone: '+237 691 44 88 10',
    vehicleLabel: 'Fourgon Climatisé Gants Blancs #04',
    vehiclePlate: 'LT-842-MV',
    waypoints: [
      { lat: 4.0268, lng: 9.6962, label: 'Galerie Bonapriso · Avenue Charles de Gaulle' },
      { lat: 4.0342, lng: 9.6939, label: 'Carrefour Hydrocarbures · Bonanjo' },
      { lat: 4.0439, lng: 9.6994, label: 'Boulevard de la Liberté · Akwa' },
      { lat: 4.0512, lng: 9.7088, label: 'Rond-Point Deïdo · Axe Bali / Koumassi' },
      { lat: 4.0394, lng: 9.7136, label: 'Zone Résidentielle · Rue Njo-Njo / Bali' },
    ],
  },
  yaounde: {
    hubName: 'Atelier & Relais Bastos · Yaoundé',
    courierName: 'Samuel Etoundi',
    courierPhone: '+237 677 32 19 04',
    vehicleLabel: 'Utilitaire Capitonnée Maison Véra #07',
    vehiclePlate: 'CE-519-MV',
    waypoints: [
      { lat: 3.8935, lng: 11.5094, label: 'Relais Bastos · Rue 1.792' },
      { lat: 3.8832, lng: 11.5142, label: 'Carrefour Bastos · Ambassades' },
      { lat: 3.8726, lng: 11.5168, label: 'Carrefour Warda · Boulevard du 20 Mai' },
      { lat: 3.8654, lng: 11.5215, label: 'Avenue Kennedy · Centre' },
      { lat: 3.8768, lng: 11.5318, label: 'Résidence Golf · Mont Fébé' },
    ],
  },
  abidjan: {
    hubName: 'Galerie Maison Véra · Cocody Ambassades',
    courierName: 'Koffi Désiré Kouamé',
    courierPhone: '+225 07 08 91 22 40',
    vehicleLabel: 'Fourgon Blindé Luxe #02',
    vehiclePlate: 'CI-409-MV',
    waypoints: [
      { lat: 5.3492, lng: -3.9912, label: 'Galerie Cocody · Rue des Ambassades' },
      { lat: 5.3418, lng: -4.0005, label: 'Carrefour Saint-Jean · Cocody' },
      { lat: 5.3315, lng: -4.0128, label: 'Boulevard Lagunaire · Plateau' },
      { lat: 5.3186, lng: -3.9994, label: 'Pont Henri Konan Bédié (HKB)' },
      { lat: 5.3082, lng: -3.9721, label: 'Zone 4 · Marcory / Riviera Résidentielle' },
    ],
  },
  dakar: {
    hubName: 'Galerie Maison Véra · Les Almadies Dakar',
    courierName: 'Moussa Ndiaye',
    courierPhone: '+221 77 645 18 90',
    vehicleLabel: 'Van Climatisé Atlantique #05',
    vehiclePlate: 'DK-712-MV',
    waypoints: [
      { lat: 14.7458, lng: -17.5144, label: 'Galerie Almadies · Route de Ngor' },
      { lat: 14.7285, lng: -17.4968, label: 'Corniche Ouest · Mamelles' },
      { lat: 14.7112, lng: -17.4792, label: 'Mermoz · Sacré-Cœur' },
      { lat: 14.6968, lng: -17.4634, label: 'Fann Résidence · Corniche' },
      { lat: 14.6774, lng: -17.4412, label: 'Dakar Plateau · Place de l’Indépendance' },
    ],
  },
  libreville: {
    hubName: 'Salon Privé La Sablière · Libreville',
    courierName: 'Brice Ondo',
    courierPhone: '+241 06 24 88 15',
    vehicleLabel: 'Fourgon Gants Blancs #03',
    vehiclePlate: 'GA-218-MV',
    waypoints: [
      { lat: 0.4562, lng: 9.4068, label: 'Galerie La Sablière · Front de Mer' },
      { lat: 0.4395, lng: 9.4152, label: 'Batterie IV · Boulevard du Bord de Mer' },
      { lat: 0.4184, lng: 9.4264, label: 'Louis · Quartier Résidentiel' },
      { lat: 0.3982, lng: 9.4415, label: 'Boulevard Triomphal Omar Bongo' },
      { lat: 0.3886, lng: 9.4522, label: 'Centre-Ville · Glass' },
    ],
  },
  kinshasa: {
    hubName: 'Comptoir Maison Véra · La Gombe Kinshasa',
    courierName: 'Patrick Ilunga',
    courierPhone: '+243 81 555 20 94',
    vehicleLabel: 'Fourgon Capitonnée Fleuve #08',
    vehiclePlate: 'KN-904-MV',
    waypoints: [
      { lat: -4.3036, lng: 15.2912, label: 'Comptoir La Gombe · Avenue Batetela' },
      { lat: -4.3088, lng: 15.3025, label: 'Rond-Point Forescom · Gombe' },
      { lat: -4.3162, lng: 15.3118, label: 'Boulevard du 30 Juin' },
      { lat: -4.3248, lng: 15.3194, label: 'Gare Centrale · Croisement Royal' },
      { lat: -4.3315, lng: 15.3268, label: 'Ngaliema / Limete Résidentiel' },
    ],
  },
  cotonou: {
    hubName: 'Relais Haie Vive · Cotonou',
    courierName: 'Rodrigue Hounsou',
    courierPhone: '+229 97 41 22 08',
    vehicleLabel: 'Navette Express Maison Véra #06',
    vehiclePlate: 'RB-315-MV',
    waypoints: [
      { lat: 6.3532, lng: 2.3982, label: 'Relais Haie Vive · Route de l’Aéroport' },
      { lat: 6.3596, lng: 2.4055, label: 'Carrefour Cadjèhoun' },
      { lat: 6.3654, lng: 2.4168, label: 'Place de l’Étoile Rouge' },
      { lat: 6.3602, lng: 2.4295, label: 'Boulevard Saint-Michel' },
      { lat: 6.3528, lng: 2.4384, label: 'Ganhi / Fidjrossè Résidentiel' },
    ],
  },
  lome: {
    hubName: 'Relais Boulevard du Mono · Lomé',
    courierName: 'Komi Mensah',
    courierPhone: '+228 90 14 78 33',
    vehicleLabel: 'Fourgon Gants Blancs #09',
    vehiclePlate: 'TG-118-MV',
    waypoints: [
      { lat: 6.1245, lng: 1.2248, label: 'Relais Boulevard du Mono · Marina' },
      { lat: 6.1312, lng: 1.2215, label: 'Place des Martyrs · Lomé' },
      { lat: 6.1388, lng: 1.2164, label: 'Avenue de la Libération' },
      { lat: 6.1465, lng: 1.2118, label: 'Tokoin Solidarité · Carrefour' },
      { lat: 6.1542, lng: 1.2065, label: 'Résidence Hédzranawoé' },
    ],
  },
  casablanca: {
    hubName: 'Galerie Anfa · Casablanca',
    courierName: 'Youssef Benali',
    courierPhone: '+212 661 48 92 10',
    vehicleLabel: 'Fourgon Capitonnée Anfa #10',
    vehiclePlate: 'MA-640-MV',
    waypoints: [
      { lat: 33.5912, lng: -7.6584, label: 'Galerie Anfa Supérieur' },
      { lat: 33.5865, lng: -7.6442, label: 'Boulevard d’Anfa · Racine' },
      { lat: 33.5812, lng: -7.6318, label: 'Quartier Gauthier' },
      { lat: 33.5754, lng: -7.6245, label: 'Maârif · Twin Center' },
      { lat: 33.5688, lng: -7.6142, label: 'Californie / Oasis' },
    ],
  },
  paris: {
    hubName: 'Galerie Saint-Germain · Paris 7e',
    courierName: 'Antoine Delacroix',
    courierPhone: '+33 6 42 88 19 05',
    vehicleLabel: 'Utilitaire Électrique Gants Blancs #01',
    vehiclePlate: 'FR-750-MV',
    waypoints: [
      { lat: 48.8542, lng: 2.3320, label: 'Galerie Saint-Germain-des-Prés' },
      { lat: 48.8588, lng: 2.3264, label: 'Quai Anatole-France · Musée d’Orsay' },
      { lat: 48.8635, lng: 2.3212, label: 'Pont de la Concorde' },
      { lat: 48.8672, lng: 2.3095, label: 'Avenue Montaigne · Triangle d’Or' },
      { lat: 48.8648, lng: 2.2932, label: 'Trocadéro · Paris 16e' },
    ],
  },
};

function normalizeCityKey(city: string, country: string): string {
  const combined = `${city} ${country}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (combined.includes('douala')) return 'douala';
  if (combined.includes('yaounde')) return 'yaounde';
  if (combined.includes('abidjan')) return 'abidjan';
  if (combined.includes('dakar')) return 'dakar';
  if (combined.includes('libreville')) return 'libreville';
  if (combined.includes('kinshasa')) return 'kinshasa';
  if (combined.includes('cotonou')) return 'cotonou';
  if (combined.includes('lome')) return 'lome';
  if (combined.includes('casablanca')) return 'casablanca';
  if (combined.includes('paris')) return 'paris';
  return 'douala';
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

export function buildCityRoutePlan(params: {
  shippingCity: string;
  shippingCountry: string;
  shippingAddress: string;
  landmark?: string;
  seedOffset?: number;
}) {
  const key = normalizeCityKey(params.shippingCity, params.shippingCountry);
  const template = CITY_TEMPLATES[key] ?? CITY_TEMPLATES.douala;

  // Deterministic subtle offset for destination based on address hash so each order has a unique endpoint
  const hashSeed = Array.from(`${params.shippingAddress}:${params.seedOffset || 1}`).reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 997,
    17
  );
  const latDelta = ((hashSeed % 19) - 9) * 0.0006;
  const lngDelta = (((hashSeed >> 3) % 19) - 9) * 0.0006;

  const waypoints: CourierWaypoint[] = template.waypoints.map((wp, idx) => {
    if (idx === template.waypoints.length - 1) {
      const destLabel = params.landmark
        ? `${params.shippingAddress} (${params.landmark})`
        : `${params.shippingAddress}, ${params.shippingCity}`;
      return {
        lat: Number((wp.lat + latDelta).toFixed(6)),
        lng: Number((wp.lng + lngDelta).toFixed(6)),
        label: destLabel,
      };
    }
    return wp;
  });

  return {
    hubName: template.hubName,
    courierName: template.courierName,
    courierPhone: template.courierPhone,
    vehicleLabel: template.vehicleLabel,
    vehiclePlate: template.vehiclePlate,
    originLat: waypoints[0].lat,
    originLng: waypoints[0].lng,
    destinationLat: waypoints[waypoints.length - 1].lat,
    destinationLng: waypoints[waypoints.length - 1].lng,
    waypoints,
  };
}

export function computeRouteTotalDistanceKm(waypoints: CourierWaypoint[]): number {
  if (waypoints.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineKm(
      waypoints[i].lat,
      waypoints[i].lng,
      waypoints[i + 1].lat,
      waypoints[i + 1].lng
    );
  }
  return Number(Math.max(1.2, total).toFixed(2));
}

export function interpolateAlongRoute(
  waypoints: CourierWaypoint[],
  rawProgressPct: number
): {
  lat: number;
  lng: number;
  headingDeg: number;
  speedKmh: number;
  etaMinutes: number;
  distanceRemainingKm: number;
  totalDistanceKm: number;
  lastCheckpoint: string;
} {
  const progressPct = Math.max(0, Math.min(100, rawProgressPct));
  const totalDistanceKm = computeRouteTotalDistanceKm(waypoints);

  if (waypoints.length === 0) {
    return {
      lat: 4.0268,
      lng: 9.6962,
      headingDeg: 45,
      speedKmh: 0,
      etaMinutes: 0,
      distanceRemainingKm: 0,
      totalDistanceKm: 0,
      lastCheckpoint: 'Galerie Maison Véra',
    };
  }

  if (waypoints.length === 1 || progressPct <= 0) {
    return {
      lat: waypoints[0].lat,
      lng: waypoints[0].lng,
      headingDeg:
        waypoints.length > 1
          ? computeBearingDeg(waypoints[0].lat, waypoints[0].lng, waypoints[1].lat, waypoints[1].lng)
          : 0,
      speedKmh: 0,
      etaMinutes: Math.max(15, Math.round(totalDistanceKm * 4.5)),
      distanceRemainingKm: totalDistanceKm,
      totalDistanceKm,
      lastCheckpoint: waypoints[0].label,
    };
  }

  if (progressPct >= 100) {
    const last = waypoints[waypoints.length - 1];
    const prev = waypoints[waypoints.length - 2];
    return {
      lat: last.lat,
      lng: last.lng,
      headingDeg: computeBearingDeg(prev.lat, prev.lng, last.lat, last.lng),
      speedKmh: 0,
      etaMinutes: 0,
      distanceRemainingKm: 0,
      totalDistanceKm,
      lastCheckpoint: `Livré à destination · ${last.label}`,
    };
  }

  const segments: number[] = [];
  let sumDist = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const d = Math.max(
      0.05,
      haversineKm(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng)
    );
    segments.push(d);
    sumDist += d;
  }

  const targetDist = (progressPct / 100) * sumDist;
  let traversed = 0;
  let segIndex = 0;
  let localT = 0;

  for (let i = 0; i < segments.length; i++) {
    if (traversed + segments[i] >= targetDist || i === segments.length - 1) {
      segIndex = i;
      localT = segments[i] > 0 ? Math.min(1, Math.max(0, (targetDist - traversed) / segments[i])) : 0;
      break;
    }
    traversed += segments[i];
  }

  const a = waypoints[segIndex];
  const b = waypoints[segIndex + 1];
  const lat = Number((a.lat + (b.lat - a.lat) * localT).toFixed(6));
  const lng = Number((a.lng + (b.lng - a.lng) * localT).toFixed(6));
  const headingDeg = computeBearingDeg(a.lat, a.lng, b.lat, b.lng);
  const distanceRemainingKm = Number(
    Math.max(0.1, totalDistanceKm * (1 - progressPct / 100)).toFixed(2)
  );
  const speedKmh = progressPct >= 85 ? 22 : 34 + ((Math.round(progressPct) * 7) % 11);
  const etaMinutes = Math.max(2, Math.round((distanceRemainingKm / Math.max(18, speedKmh)) * 60 + 3));
  const lastCheckpoint = localT >= 0.55 ? `Approche · ${b.label}` : a.label;

  return {
    lat,
    lng,
    headingDeg,
    speedKmh,
    etaMinutes,
    distanceRemainingKm,
    totalDistanceKm,
    lastCheckpoint,
  };
}
