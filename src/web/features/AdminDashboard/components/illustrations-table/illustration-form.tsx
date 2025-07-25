"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Upload, X } from "lucide-react"

// TODO: update this to conform with new API & DB
// in manual mode, it should let the user add a prompt too or select from a dropdown out of existing prompts

// Type definitions
interface SongWithIllustrationsAndPrompts {
  songId?: string
  promptId?: string
  promptModel?: string
  imageModel?: string
  imageURL?: string
  thumbnailURL?: string
  isActive?: boolean
}

interface IllustrationCreateSchema {
  songId: string
  promptId: string
  promptModel: string
  imageModel: string
  imageURL: string
  thumbnailURL: string
  isActive: boolean
}

interface DropdownOptions {
  promptIds: Array<{ value: string; label: string }>
  promptModels: Array<{ value: string; label: string }>
  imageModels: Array<{ value: string; label: string }>
}

interface IllustrationFormProps {
  illustration: Partial<SongWithIllustrationsAndPrompts>
  onSave: (data: IllustrationCreateSchema, mode: "ai" | "manual") => void
  isLoading?: boolean
  dropdownOptions: DropdownOptions
  manualOnly?: boolean
}

// Helper function to resize image to 128x128 thumbnail
const resizeImageToThumbnail = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const img = new Image()

    img.onload = () => {
      canvas.width = 128
      canvas.height = 128
      ctx.drawImage(img, 0, 0, 128, 128)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const thumbnailFile = new File([blob], `thumb_${file.name}`, {
              type: file.type,
              lastModified: Date.now(),
            })
            resolve(thumbnailFile)
          }
        },
        file.type,
        0.8,
      )
    }

    img.crossOrigin = "anonymous"
    img.src = URL.createObjectURL(file)
  })
}

export function IllustrationForm({
  illustration,
  onSave,
  isLoading,
  dropdownOptions,
  manualOnly = false,
}: IllustrationFormProps) {
  const [activeTab, setActiveTab] = useState<"ai" | "manual">(manualOnly ? "manual" : "ai")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)

  const [aiFormData, setAiFormData] = useState<Partial<IllustrationCreateSchema>>({
    songId: illustration?.songId || "",
    promptId: illustration?.promptId || "",
    promptModel: illustration?.promptModel || "",
    imageModel: illustration?.imageModel || "",
    isActive: illustration?.isActive || false,
  })

  const [manualFormData, setManualFormData] = useState<IllustrationCreateSchema>({
    songId: illustration?.songId || "",
    promptId: illustration?.promptId || "",
    promptModel: illustration?.promptModel || "",
    imageModel: illustration?.imageModel || "",
    imageURL: illustration?.imageURL || "",
    thumbnailURL: illustration?.thumbnailURL || "",
    isActive: illustration?.isActive || false,
  })

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      try {
        const thumbnailFile = await resizeImageToThumbnail(file)
        setThumbnailFile(thumbnailFile)
        setManualFormData({ ...manualFormData, imageURL: "", thumbnailURL: "" })
      } catch (error) {
        console.error("Error generating thumbnail:", error)
      }
    }
  }

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setThumbnailFile(file)
      setManualFormData({ ...manualFormData, thumbnailURL: "" })
    }
  }

  const clearImageFile = () => {
    setImageFile(null)
    setThumbnailFile(null)
    const imageInput = document.getElementById("image-upload") as HTMLInputElement
    if (imageInput) imageInput.value = ""
  }

  const clearThumbnailFile = () => {
    setThumbnailFile(null)
    const thumbnailInput = document.getElementById("thumbnail-upload") as HTMLInputElement
    if (thumbnailInput) thumbnailInput.value = ""
  }

  const handleSubmit = (e: React.FormEvent, mode: "ai" | "manual") => {
    e.preventDefault()
    const data = mode === "ai" ? (aiFormData as IllustrationCreateSchema) : manualFormData

    if (mode === "manual" && (imageFile || thumbnailFile)) {
      ;(data as any).imageFile = imageFile
      ;(data as any).thumbnailFile = thumbnailFile
    }

    onSave(data, mode)
  }

  // Shared form fields components
  const SongIdField = ({ mode }: { mode: "ai" | "manual" }) => (
    <div className="space-y-2">
      <Label htmlFor={`${mode}-songId`}>Song ID</Label>
      <Input
        id={`${mode}-songId`}
        value={mode === "ai" ? aiFormData.songId : manualFormData.songId}
        onChange={(e) => {
          const value = e.target.value
          if (mode === "ai") {
            setAiFormData({ ...aiFormData, songId: value })
          } else {
            setManualFormData({ ...manualFormData, songId: value })
          }
        }}
        required
        disabled
      />
    </div>
  )

  const PromptIdField = ({ mode }: { mode: "ai" | "manual" }) => {
    if (mode === "ai") {
      return (
        <div className="space-y-2">
          <Label htmlFor="ai-promptId">Prompt ID</Label>
          <Select
            value={aiFormData.promptId}
            onValueChange={(value) => setAiFormData({ ...aiFormData, promptId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a prompt" />
            </SelectTrigger>
            <SelectContent>
              {dropdownOptions.promptIds.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Label htmlFor="manual-promptId">Prompt ID</Label>
        <Input
          id="manual-promptId"
          value={manualFormData.promptId}
          onChange={(e) => setManualFormData({ ...manualFormData, promptId: e.target.value })}
          required
        />
      </div>
    )
  }

  const ModelFields = ({ mode }: { mode: "ai" | "manual" }) => {
    const isAi = mode === "ai"
    const data = isAi ? aiFormData : manualFormData
    const setData = isAi ? setAiFormData : setManualFormData

    if (isAi) {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Prompt Model</Label>
            <Select value={data.promptModel} onValueChange={(value) => setData({ ...data, promptModel: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select prompt model" />
              </SelectTrigger>
              <SelectContent>
                {dropdownOptions.promptModels.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Image Model</Label>
            <Select value={data.imageModel} onValueChange={(value) => setData({ ...data, imageModel: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select image model" />
              </SelectTrigger>
              <SelectContent>
                {dropdownOptions.imageModels.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="manual-promptModel">Prompt Model</Label>
          <Input
            id="manual-promptModel"
            value={data.promptModel}
            onChange={(e) => setData({ ...data, promptModel: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-imageModel">Image Model</Label>
          <Input
            id="manual-imageModel"
            value={data.imageModel}
            onChange={(e) => setData({ ...data, imageModel: e.target.value })}
            required
          />
        </div>
      </div>
    )
  }

  const ImageFields = () => (
    <>
      <div className="space-y-2">
        <Label>Image</Label>
        <div className="space-y-2">
          <Input
            placeholder="Image URL"
            value={manualFormData.imageURL}
            onChange={(e) => setManualFormData({ ...manualFormData, imageURL: e.target.value })}
            disabled={!!imageFile}
          />
          <div className="text-sm text-muted-foreground text-center">or</div>
          <div className="relative">
            <Input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" id="image-upload" />
            <Label
              htmlFor="image-upload"
              className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/25 rounded-md cursor-pointer hover:border-muted-foreground/50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {imageFile ? imageFile.name : "Upload Image"}
            </Label>
            {imageFile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0 bg-transparent"
                onClick={clearImageFile}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Thumbnail</Label>
        <div className="space-y-2">
          <Input
            placeholder="Thumbnail URL"
            value={manualFormData.thumbnailURL}
            onChange={(e) => setManualFormData({ ...manualFormData, thumbnailURL: e.target.value })}
            disabled={!!thumbnailFile || !!imageFile}
          />
          {imageFile && thumbnailFile ? (
            <div className="flex items-center gap-2 p-4 border-2 border-dashed border-green-200 rounded-md bg-green-50">
              <div className="h-4 w-4 rounded-full bg-green-500"></div>
              <span className="text-sm text-green-700">Thumbnail auto-generated from uploaded image (128x128)</span>
            </div>
          ) : !imageFile ? (
            <>
              <div className="text-sm text-muted-foreground text-center">or</div>
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailFileChange}
                  className="hidden"
                  id="thumbnail-upload"
                />
                <Label
                  htmlFor="thumbnail-upload"
                  className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/25 rounded-md cursor-pointer hover:border-muted-foreground/50 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {thumbnailFile ? thumbnailFile.name : "Upload Thumbnail"}
                </Label>
                {thumbnailFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-0 bg-transparent"
                    onClick={clearThumbnailFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  )

  const ActiveSwitch = ({ mode }: { mode: "ai" | "manual" }) => {
    const isActive = mode === "ai" ? aiFormData.isActive : manualFormData.isActive
    const setActive = (checked: boolean) => {
      if (mode === "ai") {
        setAiFormData({ ...aiFormData, isActive: checked })
      } else {
        setManualFormData({ ...manualFormData, isActive: checked })
      }
    }

    return (
      <div className="flex items-center space-x-2">
        <Switch id={`${mode}-isActive`} checked={isActive} onCheckedChange={setActive} />
        <Label htmlFor={`${mode}-isActive`}>Active</Label>
      </div>
    )
  }

  const FormContent = ({ mode }: { mode: "ai" | "manual" }) => (
    <form onSubmit={(e) => handleSubmit(e, mode)} className="space-y-4">
      <SongIdField mode={mode} />
      <PromptIdField mode={mode} />
      <ModelFields mode={mode} />
      {mode === "manual" && <ImageFields />}
      <ActiveSwitch mode={mode} />
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading
          ? mode === "ai"
            ? "Generating..."
            : "Saving..."
          : mode === "ai"
            ? "Generate with AI"
            : illustration
              ? "Update Illustration"
              : "Create Illustration"}
      </Button>
    </form>
  )

  if (manualOnly) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <FormContent mode="manual" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "ai" | "manual")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai">AI Generated</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>
        <TabsContent value="ai" className="space-y-4 mt-6">
          <FormContent mode="ai" />
        </TabsContent>
        <TabsContent value="manual" className="space-y-4 mt-6">
          <FormContent mode="manual" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
