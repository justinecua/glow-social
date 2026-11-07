import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import NoProfile from "@/assets/images/No-Profile.jpg";
import { accounts, useUpdateMyProfileMutation } from "@/redux/services/accounts/accounts";
import { setUser } from "@/redux/slices/authSlice";
import { useStoredUser } from "@/utils/auth";
import { isExplicitPhoto } from "@/lib/nudity";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";
const GENDERS = [
  { value: "", label: "Not set" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer not to say", label: "Prefer not to say" },
];

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

/** undefined = unchanged, null = removed, string = new data URL. */
const EditProfileDialog = ({ open, onOpenChange, item, profileId }) => {
  const dispatch = useDispatch();
  const me = useStoredUser();
  const [save, { isLoading }] = useUpdateMyProfileMutation();

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [birthday, setBirthday] = useState("");
  const [avatar, setAvatar] = useState(undefined);
  const [cover, setCover] = useState(undefined);
  const avatarInput = useRef(null);
  const coverInput = useRef(null);

  // Reset the form from the latest profile each time it opens.
  useEffect(() => {
    if (!open) return;
    setFirstname(item?.firstname || "");
    setLastname(item?.lastname || "");
    setBio(item?.bio && item.bio !== "None" ? item.bio : "");
    setGender((item?.gender || "").toLowerCase());
    setBirthday(item?.birthday ? String(item.birthday).slice(0, 10) : "");
    setAvatar(undefined);
    setCover(undefined);
  }, [open, item]);

  const pick = async (file, set) => {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("Use a JPG, PNG, GIF or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photos must be 8 MB or smaller.");
      return;
    }
    if (await isExplicitPhoto(file)) {
      toast.error("This photo can't be posted on Glow.");
      return;
    }
    set(await readAsDataUrl(file));
  };

  const avatarSrc = avatar === undefined ? item?.profile_photo || NoProfile : avatar || NoProfile;
  const coverSrc = cover === undefined ? item?.cover_photo || "" : cover || "";
  const hasAvatar = avatar === undefined ? !!item?.profile_photo : !!avatar;
  const hasCover = !!coverSrc;

  const onSubmit = async (e) => {
    e.preventDefault();
    const body = { firstname, lastname, bio, gender, birthday: birthday || null };
    if (avatar !== undefined) body.profile_photo = avatar;
    if (cover !== undefined) body.cover_photo = cover;

    try {
      const updated = await save(body).unwrap();
      // Profile page shows the new info right away...
      dispatch(
        accounts.util.updateQueryData("getProfile", { profile_id: profileId }, (draft) => {
          const p = Array.isArray(draft) ? draft[0] : null;
          if (p) Object.assign(p, { ...updated, profile_photo: updated.profile_photo || "" });
        })
      );
      // ...and so do the sidebars / post composer that read the signed-in user.
      if (me?.user) dispatch(setUser({ ...me, user: { ...me.user, ...updated } }));
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't save your profile. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update your photos and the info people see on your profile.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {/* Cover + avatar */}
          <div className="relative mb-10">
            <div className="relative h-32 w-full overflow-hidden rounded-lg bg-[var(--button-bg-color)]">
              {hasCover && (
                <img src={coverSrc} alt="Cover" className="h-full w-full object-cover" />
              )}
              <div className="absolute right-2 top-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => coverInput.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  {hasCover ? "Change cover" : "Add cover"}
                </Button>
                {hasCover && (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 cursor-pointer"
                    aria-label="Remove cover photo"
                    title="Remove cover photo"
                    onClick={() => setCover(null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="absolute -bottom-10 left-4">
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full border-4 border-[var(--home-card)]"
                aria-label={hasAvatar ? "Change profile photo" : "Add profile photo"}
                title={hasAvatar ? "Change profile photo" : "Add profile photo"}
              >
                <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Camera className="h-6 w-6" />
                </span>
              </button>
            </div>
            {hasAvatar && (
              <button
                type="button"
                onClick={() => setAvatar(null)}
                className="absolute -bottom-8 left-32 cursor-pointer text-xs text-[var(--color-subtitle)] hover:underline"
              >
                Remove photo
              </button>
            )}

            <input
              ref={avatarInput}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0], setAvatar);
                e.target.value = "";
              }}
            />
            <input
              ref={coverInput}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0], setCover);
                e.target.value = "";
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ep-first">First name</Label>
              <Input
                id="ep-first"
                value={firstname}
                maxLength={50}
                onChange={(e) => setFirstname(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ep-last">Last name</Label>
              <Input
                id="ep-last"
                value={lastname}
                maxLength={50}
                onChange={(e) => setLastname(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ep-bio">Bio</Label>
            <Textarea
              id="ep-bio"
              value={bio}
              maxLength={255}
              rows={3}
              placeholder="Tell people a little about yourself"
              onChange={(e) => setBio(e.target.value)}
            />
            <span className="self-end text-xs text-[var(--color-subtitle)]">{bio.length}/255</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ep-gender">Gender</Label>
              <select
                id="ep-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value} className="bg-[var(--home-card)]">
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ep-birthday">Birthday</Label>
              <Input
                id="ep-birthday"
                type="date"
                value={birthday}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setBirthday(e.target.value)}
              />
              <span className="text-xs text-[var(--color-subtitle)]">Only you can see this.</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={isLoading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="cursor-pointer bg-[var(--button-color-bg)] text-white hover:opacity-90"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;
