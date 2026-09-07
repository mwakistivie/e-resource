import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Soma Resources — Educational materials for Kenyan classrooms";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#FAF7F0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: "#2F5D50",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              color: "#FAF7F0",
              fontWeight: 600,
              marginRight: 16,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, color: "#1C2321" }}>Soma Resources</div>
        </div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 600, color: "#1C2321", lineHeight: 1.15, maxWidth: 900 }}>
          Ready-made teaching materials, delivered the moment you pay.
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#C4622D", marginTop: 32, fontWeight: 500 }}>
          Pay with M-Pesa · Download instantly · No account needed
        </div>
      </div>
    ),
    { ...size }
  );
}
