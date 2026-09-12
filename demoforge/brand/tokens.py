"""Literal colors with readable foreground/background contrast."""

from pydantic import Field, model_validator

from demoforge.schemas._base import StrictModel


class BrandTokens(StrictModel):
    background: str = Field(default="#f7f8fa", pattern=r"^#[a-fA-F0-9]{6}$")
    foreground: str = Field(default="#202321", pattern=r"^#[a-fA-F0-9]{6}$")
    accent: str = Field(default="#237454", pattern=r"^#[a-fA-F0-9]{6}$")

    def contrast_ratio(self) -> float:
        def luminance(color: str) -> float:
            channels = [int(color[offset : offset + 2], 16) / 255 for offset in (1, 3, 5)]
            linear = [
                channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
                for channel in channels
            ]
            return sum(
                value * weight
                for value, weight in zip(linear, (0.2126, 0.7152, 0.0722), strict=True)
            )

        values = sorted((luminance(self.foreground), luminance(self.background)))
        return (values[1] + 0.05) / (values[0] + 0.05)

    @model_validator(mode="after")
    def readable(self):
        if self.contrast_ratio() < 4.5:
            raise ValueError("foreground/background contrast must be at least 4.5")
        return self
