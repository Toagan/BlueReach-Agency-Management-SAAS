import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
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
    const fileName = `client-${clientId}-logo-${Date.now()}.${ext}`;

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

      // If bucket doesn't exist, store as base64 in the database
      if (uploadError.message?.includes("not found")) {
        const base64 = buffer.toString("base64");
        const dataUrl = `data:${file.type};base64,${base64}`;

        // Save directly to client record
        const { error: updateError } = await supabase
          .from("clients")
          .update({ logo_url: dataUrl })
          .eq("id", clientId);

        if (updateError) {
          console.error("Update error:", updateError);
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

    // Update client with logo URL
    const { error: updateError } = await supabase
      .from("clients")
      .update({ logo_url: logoUrl })
      .eq("id", clientId);

    if (updateError) {
      console.error("Update error:", updateError);
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
