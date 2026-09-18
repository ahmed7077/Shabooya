import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image } from "react-native";
import { Button, Card, Screen, Title } from "@/components/ui";
import { extractTimetableFromImage } from "@/lib/timetable/extraction";

export default function TimetableImportScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);

  async function pick(source: "camera" | "library") {
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.9, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function rotate() {
    if (!imageUri) return;
    const result = await ImageManipulator.manipulateAsync(imageUri, [{ rotate: 90 }], { compress: 0.95 });
    setImageUri(result.uri);
  }

  async function extract() {
    if (!imageUri) return;
    const result = await extractTimetableFromImage(imageUri);
    router.push({ pathname: "/timetable-review", params: { payload: JSON.stringify(result), imageUri } });
  }

  return (
    <Screen>
      <Title>Import timetable</Title>
      <Card>
        {imageUri ? <Image source={{ uri: imageUri }} style={{ width: "100%", height: 280, borderRadius: 8 }} /> : null}
        <Button onPress={() => pick("camera")}>Camera</Button>
        <Button tone="neutral" onPress={() => pick("library")}>Photo library</Button>
        <Button tone="neutral" onPress={rotate}>Rotate</Button>
        <Button onPress={extract}>Extract timetable</Button>
      </Card>
    </Screen>
  );
}
