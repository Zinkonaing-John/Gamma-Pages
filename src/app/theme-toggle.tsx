"use client";

import { useTheme } from "./theme-provider";
import { IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import { LightMode, DarkMode, SettingsBrightness } from "@mui/icons-material";
import { useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const icon =
    theme === "light" ? (
      <LightMode fontSize="small" />
    ) : theme === "dark" ? (
      <DarkMode fontSize="small" />
    ) : (
      <SettingsBrightness fontSize="small" />
    );

  return (
    <>
      <Tooltip title="Theme" arrow>
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ color: "inherit" }}
        >
          {icon}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 160 } }}
      >
        <MenuItem
          selected={theme === "light"}
          onClick={() => { setTheme("light"); setAnchorEl(null); }}
        >
          <ListItemIcon><LightMode fontSize="small" /></ListItemIcon>
          <ListItemText>Light</ListItemText>
        </MenuItem>
        <MenuItem
          selected={theme === "dark"}
          onClick={() => { setTheme("dark"); setAnchorEl(null); }}
        >
          <ListItemIcon><DarkMode fontSize="small" /></ListItemIcon>
          <ListItemText>Dark</ListItemText>
        </MenuItem>
        <MenuItem
          selected={theme === "system"}
          onClick={() => { setTheme("system"); setAnchorEl(null); }}
        >
          <ListItemIcon><SettingsBrightness fontSize="small" /></ListItemIcon>
          <ListItemText>System</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
