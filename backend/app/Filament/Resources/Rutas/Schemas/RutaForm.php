<?php

namespace App\Filament\Resources\Rutas\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class RutaForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Textarea::make('nombre')
                    ->required()
                    ->columnSpanFull(),
                Toggle::make('activa')
                    ->required(),
                DateTimePicker::make('last_modified')
                    ->required(),
            ]);
    }
}
