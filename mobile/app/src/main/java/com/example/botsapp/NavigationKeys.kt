package com.example.botsapp

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable data object Main : NavKey
@Serializable data object CommandCenter : NavKey
@Serializable data object Trades : NavKey
@Serializable data object Signals : NavKey
@Serializable data object Research : NavKey
@Serializable data object Performance : NavKey
@Serializable data object System : NavKey
