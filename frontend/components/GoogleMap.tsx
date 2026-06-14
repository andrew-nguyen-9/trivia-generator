"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

// Dark palette matching app (#0a0a0f background)
const DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0e0e1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b6b80" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#26263a" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#4a4a60" }] },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1a28" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#22223a" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#05050d" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#26263a" }] },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMap = any;

export default function GoogleMap({
  guess,
  truth,
  onPick,
  disabled,
  accent,
}: {
  guess: LatLng | null;
  truth: LatLng | null;
  onPick: (p: LatLng) => void;
  disabled: boolean;
  accent: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const refs = useRef<{
    map: AnyMap;
    g: AnyMap;
    guessMarker: AnyMap;
    truthMarker: AnyMap;
    line: AnyMap;
  }>({ map: null, g: null, guessMarker: null, truthMarker: null, line: null });
  const [ready, setReady] = useState(false);

  // Keep latest callbacks in refs so the click listener never goes stale
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !divRef.current) return;

    import("@googlemaps/js-api-loader")
      .then(({ Loader }) => {
        const loader = new Loader({ apiKey, version: "weekly" });
        return loader.load();
      })
      .then(() => {
        if (!divRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = (window as any).google;
        refs.current.g = g;

        const map = new g.maps.Map(divRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          minZoom: 1,
          styles: DARK_STYLES,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          backgroundColor: "#0a0a0f",
        });
        refs.current.map = map;

        map.addListener("click", (e: AnyMap) => {
          if (!disabledRef.current) {
            onPickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        });

        setReady(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update guess marker whenever `guess` changes
  useEffect(() => {
    if (!ready) return;
    const { map, g, guessMarker } = refs.current;
    if (guessMarker) { guessMarker.setMap(null); refs.current.guessMarker = null; }
    if (guess) {
      refs.current.guessMarker = new g.maps.Marker({
        position: { lat: guess.lat, lng: guess.lng },
        map,
        icon: {
          path: 0, // google.maps.SymbolPath.CIRCLE
          scale: 8,
          fillColor: "#f5f3ee",
          fillOpacity: 1,
          strokeColor: "#0a0a0f",
          strokeWeight: 2,
        },
        zIndex: 2,
      });
    }
  }, [guess, ready]);

  // Reveal truth marker + geodesic line when locked
  useEffect(() => {
    if (!ready || !truth) return;
    const { map, g, truthMarker, line } = refs.current;
    if (truthMarker) { truthMarker.setMap(null); refs.current.truthMarker = null; }
    if (line) { line.setMap(null); refs.current.line = null; }

    refs.current.truthMarker = new g.maps.Marker({
      position: { lat: truth.lat, lng: truth.lng },
      map,
      icon: {
        path: 0,
        scale: 10,
        fillColor: accent,
        fillOpacity: 1,
        strokeColor: "#0a0a0f",
        strokeWeight: 2,
      },
      zIndex: 3,
    });

    if (guess) {
      refs.current.line = new g.maps.Polyline({
        path: [
          { lat: guess.lat, lng: guess.lng },
          { lat: truth.lat, lng: truth.lng },
        ],
        strokeColor: accent,
        strokeWeight: 2,
        strokeOpacity: 0.8,
        map,
        geodesic: true,
      });

      // Fit both pins in view
      const bounds = new g.maps.LatLngBounds();
      bounds.extend({ lat: guess.lat, lng: guess.lng });
      bounds.extend({ lat: truth.lat, lng: truth.lng });
      map.fitBounds(bounds, 80);
    }
  }, [truth, accent, guess, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={divRef}
      className="h-96 w-full rounded-2xl border border-line"
      style={{ cursor: disabled ? "default" : "crosshair" }}
    />
  );
}
