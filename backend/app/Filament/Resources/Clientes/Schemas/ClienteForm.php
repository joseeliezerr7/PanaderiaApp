<?php

namespace App\Filament\Resources\Clientes\Schemas;

use App\Models\Cliente;
use App\Models\ClienteDiaVisita;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class ClienteForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('nombre')
                    ->required(),
                TextInput::make('negocio'),
                Textarea::make('direccion')
                    ->columnSpanFull(),
                TextInput::make('telefono')
                    ->label('Teléfono'),
                Select::make('ruta_id')
                    ->label('Ruta')
                    ->relationship('ruta', 'nombre')
                    ->preload()
                    ->searchable(),
                TextInput::make('orden_visita')
                    ->label('Orden de visita')
                    ->numeric(),
                Select::make('usuario_id')
                    ->label('Vendedor')
                    ->relationship('usuario', 'nombre'),
                CheckboxList::make('dias_visita')
                    ->label('Días de visita')
                    ->options(ClienteDiaVisita::DIAS)
                    ->columns(4)
                    ->afterStateHydrated(function (CheckboxList $component, ?Cliente $record) {
                        $component->state($record?->diasVisita->pluck('dia_num')->map(fn ($d) => (string) $d)->all() ?? []);
                    })
                    ->dehydrated(false)
                    ->saveRelationshipsUsing(function (Cliente $record, ?array $state) {
                        $marcados = array_map('intval', $state ?? []);
                        // soft delete / restore para que el cambio se propague por sync
                        $existentes = $record->diasVisita()->withTrashed()->get();
                        foreach ($existentes as $dia) {
                            if (in_array($dia->dia_num, $marcados, true)) {
                                $dia->trashed() && $dia->restore();
                            } else {
                                $dia->trashed() || $dia->delete();
                            }
                        }
                        $nuevos = array_diff($marcados, $existentes->pluck('dia_num')->all());
                        foreach ($nuevos as $diaNum) {
                            $record->diasVisita()->create(['dia_num' => $diaNum]);
                        }
                    }),
                TextInput::make('lat')
                    ->label('Latitud')
                    ->numeric(),
                TextInput::make('lng')
                    ->label('Longitud')
                    ->numeric(),
                Toggle::make('activo')
                    ->required(),
            ]);
    }
}
