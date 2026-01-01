import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 2MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "png";
    const fileName = `agency-logo-${Date.now()}.${ext}`;

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("logos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);

      // If bucket doesn't exist, try to create it
      if (uploadError.message?.includes("not found")) {
        // Store as base64 in settings instead
        const base64 = buffer.toString("base64");
        const dataUrl = `data:${file.type};base64,${base64}`;

        // Save to settings table
        const { error: settingsError } = await supabase
          .from("settings")
          .upsert({
            key: "agency_logo_url",
            value: dataUrl,
            is_encrypted: false,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "key",
          });

        if (settingsError) {
          console.error("Settings error:", settingsError);
          return NextResponse.json(
            { error: "Failed to save logo" },
            { status: 500 }
          );
        }

        return NextResponse.json({ url: dataUrl });
      }

      return NextResponse.json(
        { error: uploadError.message || "Failed to upload logo" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("logos")
      .getPublicUrl(fileName);

    const logoUrl = urlData.publicUrl;

    // Save URL to settings
    const { error: settingsError } = await supabase
      .from("settings")
      .upsert({
        key: "agency_logo_url",
        value: logoUrl,
        is_encrypted: false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "key",
      });

    if (settingsError) {
      console.error("Settings error:", settingsError);
    }

    return NextResponse.json({ url: logoUrl });
  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload logo" },
      { status: 500 }
    );
  }
}
