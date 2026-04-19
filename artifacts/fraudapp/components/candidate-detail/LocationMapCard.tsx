import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { MapPin, Navigation } from 'lucide-react';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationData {
    lat: number;
    lng: number;
    label: string;
}

interface LocationMapCardProps {
    ipLocation: LocationData;
    documentLocation?: LocationData;
    distanceKm?: number;
}

const LocationMapCard: React.FC<LocationMapCardProps> = ({
    ipLocation,
    documentLocation,
    distanceKm
}) => {
    const center: [number, number] = [ipLocation.lat, ipLocation.lng];
    const hasDocumentLocation = documentLocation && documentLocation.lat && documentLocation.lng;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <MapPin size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Geolocation Analysis</h3>
                </div>
                {distanceKm !== null && distanceKm !== undefined && (
                    <div className="flex items-center gap-1 bg-white dark:bg-gray-700 px-2 py-1 rounded-full">
                        <Navigation size={14} className="text-orange-600" />
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{distanceKm.toFixed(0)} km</span>
                    </div>
                )}
            </div>

            {/* Map */}
            <div className="relative h-64 w-full">
                <MapContainer
                    center={center}
                    zoom={hasDocumentLocation ? 5 : 10}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* IP Location Marker */}
                    <Marker position={[ipLocation.lat, ipLocation.lng]}>
                        <Popup>
                            <div className="text-xs">
                                <p className="font-bold text-blue-600">IP Location</p>
                                <p>{ipLocation.label}</p>
                            </div>
                        </Popup>
                    </Marker>

                    {/* Document Location Marker (if different) */}
                    {hasDocumentLocation && (
                        <>
                            <Marker position={[documentLocation.lat, documentLocation.lng]}>
                                <Popup>
                                    <div className="text-xs">
                                        <p className="font-bold text-green-600">Document Location</p>
                                        <p>{documentLocation.label}</p>
                                    </div>
                                </Popup>
                            </Marker>

                            {/* Line connecting both locations */}
                            <Polyline
                                positions={[
                                    [ipLocation.lat, ipLocation.lng],
                                    [documentLocation.lat, documentLocation.lng]
                                ]}
                                color="orange"
                                weight={2}
                                dashArray="5, 10"
                            />
                        </>
                    )}
                </MapContainer>
            </div>

            {/* Location Details */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50">
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">IP Location</p>
                        <p className="text-gray-800 dark:text-white font-semibold">{ipLocation.label}</p>
                    </div>
                    {hasDocumentLocation && (
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Document Location</p>
                            <p className="text-gray-800 dark:text-white font-semibold">{documentLocation.label}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LocationMapCard;
